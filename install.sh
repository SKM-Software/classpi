#!/usr/bin/env bash
#
# ClassPi OS installer
# --------------------
# Turns a fresh Raspberry Pi OS (Bookworm) install into a branded, kiosk-mode
# Computing Science classroom device that boots straight into the ClassPi apps.
#
#   Recommended base image: Raspberry Pi OS Lite (64-bit), Bookworm or Trixie.
#   Run on the Pi itself:  sudo bash install.sh
#
# Safe to re-run: it is idempotent and just re-applies the configuration.
#
set -euo pipefail

# --------------------------------------------------------------- pretty output
BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; NC=$'\033[0m'
say()  { echo "${GREEN}${BOLD}==>${NC} $*"; }
warn() { echo "${YELLOW}${BOLD}!! ${NC} $*"; }
die()  { echo "${RED}${BOLD}xx ${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Please run with sudo:  sudo bash install.sh"

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_USER="${SUDO_USER:-pi}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
[[ -n "$TARGET_HOME" ]] || die "Could not find home directory for user '$TARGET_USER'."
TARGET_UID="$(id -u "$TARGET_USER")"

INSTALL_DIR="/opt/classpi"
CONFIG_DIR="/etc/classpi"
CONFIG_FILE="$CONFIG_DIR/config.json"

# --------------------------------------------------------------- gather config
# Precedence: environment variable > existing config (re-runs / updates) > built-in default.
existing() {
  [[ -f "$CONFIG_FILE" ]] || return 0
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2], ""))' \
    "$CONFIG_FILE" "$1" 2>/dev/null || true
}
DEVICE_NAME="${CLASSPI_NAME:-$(existing device_name)}";   DEVICE_NAME="${DEVICE_NAME:-ClassPi}"
SCHOOL_NAME="${CLASSPI_SCHOOL:-$(existing school_name)}"; SCHOOL_NAME="${SCHOOL_NAME:-Computing Science}"
NET_KEY="${CLASSPI_NET_KEY:-$(existing net_key)}";        NET_KEY="${NET_KEY:-clyde-kelvin}"

if [[ -t 0 ]]; then
  echo
  echo "${BOLD}ClassPi OS setup${NC}"
  echo "Press Enter to accept the [default] in brackets."
  echo
  read -rp "Device name (shown on screen)  [$DEVICE_NAME]: " x;    DEVICE_NAME="${x:-$DEVICE_NAME}"
  read -rp "School / department name  [$SCHOOL_NAME]: " x;         SCHOOL_NAME="${x:-$SCHOOL_NAME}"
  read -rp "Network Lab shared key  [$NET_KEY]: " x;               NET_KEY="${x:-$NET_KEY}"
else
  warn "No terminal input - keeping existing/default settings (set CLASSPI_NAME / CLASSPI_NET_KEY etc. to override)."
fi

# --------------------------------------------------------------- packages
say "Checking internet connection..."
if ! getent hosts archive.raspberrypi.com >/dev/null 2>&1; then
  die "This Pi can't reach the internet. Plug in ethernet, or set Wi-Fi with 'sudo raspi-config'
    (Localisation Options > WLAN Country first, then System Options > Wireless LAN), then run this again."
fi

say "Installing packages (this can take a few minutes)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq || die "Could not update the package list - check the internet connection."
# cage = minimal Wayland kiosk compositor; seatd lets it run without a full desktop.
apt-get install -y --no-install-recommends \
  python3 python3-venv python3-pip curl git \
  cage seatd plymouth plymouth-themes fonts-dejavu \
  || die "Package install failed - see the messages above."
# Chromium is called 'chromium' on Trixie and newer, 'chromium-browser' on older Bookworm images.
apt-get install -y --no-install-recommends chromium \
  || apt-get install -y --no-install-recommends chromium-browser \
  || die "Chromium could not be installed - see the messages above."

CHROMIUM_BIN="$(command -v chromium || command -v chromium-browser || true)"
[[ -n "$CHROMIUM_BIN" ]] || die "Chromium installed but its program could not be found."

# --------------------------------------------------------------- app files
say "Copying ClassPi to $INSTALL_DIR ..."
mkdir -p "$INSTALL_DIR"
cp -r "$SRC_DIR/app/." "$INSTALL_DIR/"

say "Creating Python environment..."
python3 -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install --quiet -r "$INSTALL_DIR/requirements.txt"

# --------------------------------------------------------------- config + work dir
say "Writing configuration..."
mkdir -p "$CONFIG_DIR"
WORK_DIR="$TARGET_HOME/ClassPi-Work"
# Merge into the existing file so settings added by hand (browser links, the
# search engine, Wi-Fi country...) survive a re-run. Values travel through the
# environment, so free-text answers need no JSON escaping.
CFG_FILE="$CONFIG_FILE" CFG_NAME="$DEVICE_NAME" CFG_SCHOOL="$SCHOOL_NAME" \
CFG_KEY="$NET_KEY" CFG_WORK="$WORK_DIR" CFG_REPO="$SRC_DIR" CFG_COUNTRY="${CLASSPI_WIFI_COUNTRY:-}" \
python3 - <<'PY'
import json, os
e = os.environ
path = e["CFG_FILE"]
try:
    with open(path) as f:
        cfg = json.load(f)
    if not isinstance(cfg, dict):
        cfg = {}
except (OSError, ValueError):
    cfg = {}
cfg.update({
    "device_name": e["CFG_NAME"], "school_name": e["CFG_SCHOOL"],
    "net_key": e["CFG_KEY"],
    "host": "127.0.0.1", "port": 8080,
    "work_dir": e["CFG_WORK"], "repo_dir": e["CFG_REPO"],
})
cfg.pop("teacher_pin", None)   # PINs were replaced by simple confirmations
cfg.setdefault("net_port", 8090)
cfg.setdefault("run_timeout_seconds", 5)
if e["CFG_COUNTRY"]:
    cfg["wifi_country"] = e["CFG_COUNTRY"].upper()
cfg.setdefault("wifi_country", "GB")
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
PY
# The services run as $TARGET_USER, so they must be able to read this file;
# keep it hidden from everyone else (the PIN lives here).
chown root:"$TARGET_USER" "$CONFIG_FILE"
chmod 640 "$CONFIG_FILE"
mkdir -p "$WORK_DIR"
chown -R "$TARGET_USER":"$TARGET_USER" "$WORK_DIR"

# hostname from device name (lowercased, safe chars)
NEW_HOST="$(echo "$DEVICE_NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
NEW_HOST="${NEW_HOST:-classpi}"
if [[ "$(hostname)" != "$NEW_HOST" ]]; then
  say "Setting hostname to '$NEW_HOST'..."
  echo "$NEW_HOST" > /etc/hostname
  sed -i "s/127.0.1.1.*/127.0.1.1\t$NEW_HOST/" /etc/hosts || true
  hostnamectl set-hostname "$NEW_HOST" 2>/dev/null || true
fi

# Root-side half of the in-app updater: copy the already-pulled files into
# place and restart the services. Kept root-owned in /usr/local/sbin so the
# passwordless sudo entry below cannot be repointed at user-editable code.
cat > /usr/local/sbin/classpi-apply-update <<APPLY
#!/usr/bin/env bash
set -euo pipefail
cp -r "$SRC_DIR/app/." "$INSTALL_DIR/"
"$INSTALL_DIR/venv/bin/pip" install --quiet -r "$INSTALL_DIR/requirements.txt"
systemctl restart classpi classpi-net
APPLY
chmod 755 /usr/local/sbin/classpi-apply-update

# Direct-cable lab mode: put this Pi on a fixed 10.0.0.x address so two or three
# Pis wired straight to each other (no switch, no router) can still talk. The
# middle Pi bridges its two network ports so traffic really does pass through it.
cat > /usr/local/sbin/classpi-labnet <<'LABNET'
#!/usr/bin/env bash
# Switch this Pi between the normal network and the direct-cable lab.
#   classpi-labnet sender|middle|receiver|normal
set -euo pipefail
command -v nmcli >/dev/null || { echo "NetworkManager (nmcli) not found."; exit 3; }

LAB=10.0.0
OURS=(classpi-lab classpi-br classpi-br-s1 classpi-br-s2)

eth_devices() {
  nmcli -t -f DEVICE,TYPE device status 2>/dev/null \
    | awk -F: '$2=="ethernet"{print $1}' | grep -v '^br' || true
}
drop_ours() { for c in "${OURS[@]}"; do nmcli con delete "$c" >/dev/null 2>&1 || true; done; }

case "${1:-}" in
  sender|receiver)
    [[ ${1} == sender ]] && N=1 || N=3
    DEV="$(eth_devices | head -n1)"
    [[ -n "$DEV" ]] || { echo "No wired network port found."; exit 4; }
    drop_ours
    # never-default: keep the school network / Wi-Fi as the route to the internet.
    nmcli con add type ethernet con-name classpi-lab ifname "$DEV" \
      ipv4.method manual ipv4.addresses "$LAB.$N/24" ipv4.never-default yes \
      connection.autoconnect-priority 100 >/dev/null
    nmcli con up classpi-lab >/dev/null
    echo "This Pi is now $LAB.$N on $DEV"
    ;;
  middle)
    mapfile -t DEVS < <(eth_devices)
    [[ ${#DEVS[@]} -ge 2 ]] || {
      echo "Needs two wired ports - plug in a USB ethernet adapter."; exit 5; }
    drop_ours
    # stp off: with it on the bridge blocks traffic for ~30s, which looks broken
    # in the middle of a lesson.
    nmcli con add type bridge con-name classpi-br ifname br0 \
      ipv4.method manual ipv4.addresses "$LAB.2/24" ipv4.never-default yes \
      bridge.stp no connection.autoconnect-priority 100 >/dev/null
    nmcli con add type ethernet con-name classpi-br-s1 ifname "${DEVS[0]}" master br0 >/dev/null
    nmcli con add type ethernet con-name classpi-br-s2 ifname "${DEVS[1]}" master br0 >/dev/null
    nmcli con up classpi-br >/dev/null
    echo "This Pi is now $LAB.2, bridging ${DEVS[0]} and ${DEVS[1]}"
    ;;
  normal)
    drop_ours
    # -w 0: do not wait for the port to come back up. A Pi still wired to
    # another Pi has no DHCP server to answer it, and waiting for that to give
    # up took longer than the app allows - Back to normal looked broken even
    # though the lab address was already gone. NetworkManager finishes
    # bringing the port up on its own.
    for d in $(eth_devices); do nmcli -w 0 device connect "$d" >/dev/null 2>&1 || true; done
    echo "Back on the normal network"
    ;;
  *) echo "Usage: classpi-labnet sender|middle|receiver|normal"; exit 2 ;;
esac
LABNET
chmod 755 /usr/local/sbin/classpi-labnet

# Wi-Fi changes for the System app. Reading (status, scan) is done by the app
# itself with nmcli; only these three actions need root. The password arrives
# on stdin so it never shows in a process list.
cat > /usr/local/sbin/classpi-wifi <<'WIFI'
#!/usr/bin/env bash
# classpi-wifi connect <ssid> [hidden]   stdin: password, then a username (802.1X) - either may be blank
# classpi-wifi forget <ssid>
# classpi-wifi on <country>
set -euo pipefail
command -v nmcli >/dev/null || { echo "NetworkManager (nmcli) not found."; exit 3; }

wifi_dev() { nmcli -t -f DEVICE,TYPE device status 2>/dev/null | awk -F: '$2=="wifi"{print $1; exit}'; }

# Every saved profile for a network name. nmcli names its own after the SSID,
# but Raspberry Pi Imager's is called "preconfigured", so look inside each.
profiles_for() {
  nmcli -t -f NAME,TYPE connection show 2>/dev/null | awk -F: '$2=="802-11-wireless"{print $1}' \
    | while IFS= read -r name; do
        if [[ "$(nmcli -g 802-11-wireless.ssid connection show "$name" 2>/dev/null)" == "$1" ]]; then echo "$name"; fi
      done
  return 0
}
drop_profiles() {
  profiles_for "$1" | while IFS= read -r name; do nmcli connection delete "$name" >/dev/null 2>&1 || true; done
}

case "${1:-}" in
  connect)
    SSID="${2:-}"; [[ -n "$SSID" ]] || { echo "No network name given."; exit 2; }
    DEV="$(wifi_dev)"; [[ -n "$DEV" ]] || { echo "No Wi-Fi hardware found."; exit 4; }
    IFS= read -r PASS || true
    IFS= read -r IDENT || true
    HIDDEN=(); [[ "${3:-}" == hidden ]] && HIDDEN=(802-11-wireless.hidden yes)
    # Start clean, so a corrected password is not shadowed by the old profile.
    drop_profiles "$SSID"
    if [[ -n "$IDENT" ]]; then
      # WPA2-Enterprise with a username and password (PEAP/MSCHAPv2 - the usual school setup).
      nmcli connection add type wifi con-name "$SSID" ifname "$DEV" ssid "$SSID" ${HIDDEN[@]+"${HIDDEN[@]}"} \
        wifi-sec.key-mgmt wpa-eap 802-1x.eap peap 802-1x.phase2-auth mschapv2 \
        802-1x.identity "$IDENT" 802-1x.password "$PASS" >/dev/null
    elif [[ -n "$PASS" ]]; then
      nmcli connection add type wifi con-name "$SSID" ifname "$DEV" ssid "$SSID" ${HIDDEN[@]+"${HIDDEN[@]}"} \
        wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PASS" >/dev/null
    else
      nmcli connection add type wifi con-name "$SSID" ifname "$DEV" ssid "$SSID" ${HIDDEN[@]+"${HIDDEN[@]}"} >/dev/null
    fi
    if ! OUT="$(nmcli -w 40 connection up "$SSID" 2>&1)"; then
      nmcli connection delete "$SSID" >/dev/null 2>&1 || true   # leave no broken profile behind
      echo "$OUT"; exit 6
    fi
    echo "Connected to $SSID"
    ;;
  forget)
    SSID="${2:-}"; [[ -n "$SSID" ]] || { echo "No network name given."; exit 2; }
    drop_profiles "$SSID"
    echo "Forgot $SSID"
    ;;
  on)
    CC="${2:-}"
    # A fresh Pi OS image keeps the radio blocked until a country has been set.
    if [[ "$CC" =~ ^[A-Z]{2}$ ]]; then
      if command -v raspi-config >/dev/null; then raspi-config nonint do_wifi_country "$CC" >/dev/null 2>&1 || true; fi
      iw reg set "$CC" >/dev/null 2>&1 || true
    fi
    rfkill unblock wifi 2>/dev/null || true
    nmcli radio wifi on
    echo "Wi-Fi is on"
    ;;
  *) echo "Usage: classpi-wifi connect <ssid> [hidden] | forget <ssid> | on <country>"; exit 2 ;;
esac
WIFI
chmod 755 /usr/local/sbin/classpi-wifi

# Classroom lockdown for the Browser tile, plus a way back: a "ClassPi"
# bookmark and the Home button both open the start page. Chromium reads these
# managed policies for every window, including the kiosk (which shows no UI).
# No SafeSitesFilterBehavior: it asks Google about every page load, the
# kiosk's own included, and behind a Wi-Fi sign-in portal that question
# hangs - so the whole ClassPi screen crawled until the portal was signed in.
for d in /etc/chromium/policies/managed /etc/chromium-browser/policies/managed; do
  mkdir -p "$d"
  cat > "$d/classpi.json" <<'POLICY'
{
  "HomepageLocation": "http://127.0.0.1:8080/browser.html",
  "HomepageIsNewTabPage": false,
  "NewTabPageLocation": "http://127.0.0.1:8080/browser.html",
  "ShowHomeButton": true,
  "BookmarkBarEnabled": true,
  "ManagedBookmarks": [
    { "toplevel_name": "ClassPi" },
    { "name": "ClassPi home", "url": "http://127.0.0.1:8080/browser.html" }
  ],
  "DeveloperToolsAvailability": 2,
  "IncognitoModeAvailability": 1,
  "BrowserSignin": 0,
  "SyncDisabled": true,
  "PasswordManagerEnabled": false,
  "AutofillCreditCardEnabled": false,
  "AutofillAddressEnabled": false,
  "DownloadRestrictions": 3,
  "ExtensionInstallBlocklist": ["*"],
  "URLBlocklist": ["file://*", "chrome://settings", "chrome://flags", "chrome://extensions", "chrome://downloads"],
  "ForceGoogleSafeSearch": true,
  "ForceYouTubeRestrict": 1,
  "DefaultNotificationsSetting": 2,
  "DefaultGeolocationSetting": 2,
  "DefaultBrowserSettingEnabled": false,
  "MetricsReportingEnabled": false,
  "PromotionalTabsEnabled": false,
  "TranslateEnabled": false,
  "BackgroundModeEnabled": false
}
POLICY
done

# allow the app to run only these exact power/kiosk/update/network commands without a password
cat > /etc/sudoers.d/classpi <<SUDO
$TARGET_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reboot, /usr/bin/systemctl poweroff, /usr/bin/systemctl stop classpi-kiosk.service, /usr/bin/systemctl start getty@tty1.service, /usr/local/sbin/classpi-apply-update, /usr/local/sbin/classpi-labnet sender, /usr/local/sbin/classpi-labnet middle, /usr/local/sbin/classpi-labnet receiver, /usr/local/sbin/classpi-labnet normal, /usr/local/sbin/classpi-wifi connect *, /usr/local/sbin/classpi-wifi forget *, /usr/local/sbin/classpi-wifi on *
SUDO
chmod 440 /etc/sudoers.d/classpi

# --------------------------------------------------------------- services
say "Installing services..."

# 1) The local app server (launcher + apps), bound to localhost.
cat > /etc/systemd/system/classpi.service <<UNIT
[Unit]
Description=ClassPi app server
After=network.target

[Service]
Type=simple
User=$TARGET_USER
Environment=CLASSPI_CONFIG=$CONFIG_FILE
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/server.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

# 2) The Network Lab node, reachable on the LAN (0.0.0.0:8090).
cat > /etc/systemd/system/classpi-net.service <<UNIT
[Unit]
Description=ClassPi Network Lab node
After=network.target

[Service]
Type=simple
User=$TARGET_USER
Environment=CLASSPI_CONFIG=$CONFIG_FILE
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/netnode.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

# 3) The kiosk: cage launches Chromium full-screen pointing at the launcher.
mkdir -p "$INSTALL_DIR/bin"
cat > "$INSTALL_DIR/bin/kiosk.sh" <<KIOSK
#!/usr/bin/env bash
# Wait for the app server to answer before opening the browser.
for i in \$(seq 1 30); do
  if curl -sf http://127.0.0.1:8080/api/info >/dev/null 2>&1; then break; fi
  sleep 1
done
# Record which Wayland socket this screen is, so the app server can open the
# web browser window on it.
printf '%s' "\${WAYLAND_DISPLAY:-}" > "\${XDG_RUNTIME_DIR:-/run/user/$TARGET_UID}/classpi-wayland" 2>/dev/null || true
# No --incognito: quiz best scores, autosaved code and name lists live in
# localStorage and should survive a reboot.
exec $CHROMIUM_BIN \\
  --kiosk --ozone-platform=wayland --noerrdialogs --disable-infobars \\
  --no-first-run --fast --fast-start --disable-translate \\
  --disable-features=TranslateUI --disable-pinch --overscroll-history-navigation=0 \\
  --check-for-update-interval=31536000 \\
  --app=http://127.0.0.1:8080/
KIOSK
chmod +x "$INSTALL_DIR/bin/kiosk.sh"

cat > /etc/systemd/system/classpi-kiosk.service <<UNIT
[Unit]
Description=ClassPi kiosk display
After=classpi.service systemd-user-sessions.service plymouth-quit-wait.service dbus.socket systemd-logind.service
Wants=classpi.service dbus.socket systemd-logind.service
# Take tty1 from the normal login prompt so the kiosk owns the screen.
Conflicts=getty@tty1.service
After=getty@tty1.service
ConditionPathExists=/dev/tty1

[Service]
Type=simple
User=$TARGET_USER
PAMName=login
UtmpIdentifier=tty1
UtmpMode=user
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
StandardInput=tty-fail
StandardOutput=journal
StandardError=journal
# Use the real UID: %U in a system unit resolves to the manager's user (root),
# not the User= setting.
Environment=XDG_RUNTIME_DIR=/run/user/$TARGET_UID
Environment=WLR_LIBINPUT_NO_DEVICES=1
ExecStart=/usr/bin/cage -s -- $INSTALL_DIR/bin/kiosk.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

# Add groups one at a time - a single missing group would otherwise skip them all.
for g in video input render; do
  getent group "$g" >/dev/null && usermod -aG "$g" "$TARGET_USER" || true
done

# Boot to console (no login manager) - the kiosk service owns tty1.
systemctl set-default multi-user.target >/dev/null 2>&1 || true

systemctl daemon-reload
systemctl enable classpi.service classpi-net.service classpi-kiosk.service >/dev/null
systemctl restart classpi.service classpi-net.service

# --------------------------------------------------------------- boot splash
if [[ -f "$SRC_DIR/branding/splash.png" ]] && command -v plymouth-set-default-theme >/dev/null; then
  say "Installing boot splash..."
  THEME_DIR="/usr/share/plymouth/themes/classpi"
  mkdir -p "$THEME_DIR"
  cp "$SRC_DIR/branding/splash.png" "$THEME_DIR/splash.png"
  cat > "$THEME_DIR/classpi.plymouth" <<PLY
[Plymouth Theme]
Name=ClassPi
ModuleName=script

[script]
ImageDir=$THEME_DIR
ScriptFile=$THEME_DIR/classpi.script
PLY
  cat > "$THEME_DIR/classpi.script" <<'PLY'
wallpaper = Image("splash.png");
sw = Window.GetWidth(); sh = Window.GetHeight();
scale = sw / wallpaper.GetWidth();
if (wallpaper.GetHeight() * scale > sh) scale = sh / wallpaper.GetHeight();
bg = wallpaper.Scale(wallpaper.GetWidth() * scale, wallpaper.GetHeight() * scale);
sprite = Sprite(bg);
sprite.SetX((sw - bg.GetWidth()) / 2);
sprite.SetY((sh - bg.GetHeight()) / 2);
PLY
  plymouth-set-default-theme -R classpi >/dev/null 2>&1 || \
    plymouth-set-default-theme classpi >/dev/null 2>&1 || warn "Could not rebuild splash; it will apply after next update."
  # Quiet, splash-friendly boot
  CMDLINE=/boot/firmware/cmdline.txt; [[ -f $CMDLINE ]] || CMDLINE=/boot/cmdline.txt
  if [[ -f $CMDLINE ]] && ! grep -q "quiet splash" "$CMDLINE"; then
    sed -i 's/$/ quiet splash plymouth.ignore-serial-consoles logo.nologo vt.global_cursor_default=0/' "$CMDLINE"
  fi
fi

echo
say "${BOLD}ClassPi is installed.${NC}"
echo "  Device name : $DEVICE_NAME"
echo "  Hostname    : $NEW_HOST  (reach it at http://$NEW_HOST.local on your network)"
echo "  Pupil work  : $WORK_DIR"
echo
echo "  Web browser : the Browser tile opens Chromium on top of ClassPi (Back to ClassPi closes it)."
echo "  Wi-Fi       : System > Wi-Fi to join a network."
echo
echo "  For the Network Lab, install ClassPi on each Pi and wire them together."
echo "  On the sender's screen open Network Lab and enter the other Pis' addresses."
echo
say "Reboot now to start in kiosk mode:  ${BOLD}sudo reboot${NC}"
