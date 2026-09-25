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
TEACHER_PIN="${CLASSPI_PIN:-$(existing teacher_pin)}";    TEACHER_PIN="${TEACHER_PIN:-1234}"
NET_KEY="${CLASSPI_NET_KEY:-$(existing net_key)}";        NET_KEY="${NET_KEY:-clyde-kelvin}"
RUN_TIMEOUT="$(existing run_timeout_seconds)"; [[ "$RUN_TIMEOUT" =~ ^[0-9]+$ ]] || RUN_TIMEOUT=5
NET_PORT="$(existing net_port)";               [[ "$NET_PORT" =~ ^[0-9]+$ ]] || NET_PORT=8090

if [[ -t 0 ]]; then
  echo
  echo "${BOLD}ClassPi OS setup${NC}"
  echo "Press Enter to accept the [default] in brackets."
  echo
  read -rp "Device name (shown on screen)  [$DEVICE_NAME]: " x;    DEVICE_NAME="${x:-$DEVICE_NAME}"
  read -rp "School / department name  [$SCHOOL_NAME]: " x;         SCHOOL_NAME="${x:-$SCHOOL_NAME}"
  read -rp "Teacher PIN (for power/exit)  [$TEACHER_PIN]: " x;     TEACHER_PIN="${x:-$TEACHER_PIN}"
  read -rp "Network Lab shared key  [$NET_KEY]: " x;               NET_KEY="${x:-$NET_KEY}"
else
  warn "No terminal input - keeping existing/default settings (set CLASSPI_NAME / CLASSPI_PIN etc. to override)."
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
  python3 python3-venv python3-pip curl \
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
# Escape backslashes and double quotes so free-text answers stay valid JSON.
json_escape() { local s=${1//'\'/'\\'}; s=${s//'"'/'\"'}; printf '%s' "$s"; }
cat > "$CONFIG_FILE" <<JSON
{
  "device_name": "$(json_escape "$DEVICE_NAME")",
  "school_name": "$(json_escape "$SCHOOL_NAME")",
  "teacher_pin": "$(json_escape "$TEACHER_PIN")",
  "net_key": "$(json_escape "$NET_KEY")",
  "host": "127.0.0.1",
  "port": 8080,
  "net_port": $NET_PORT,
  "work_dir": "$(json_escape "$WORK_DIR")",
  "run_timeout_seconds": $RUN_TIMEOUT
}
JSON
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

# allow the app to run only these exact power/kiosk commands without a password
cat > /etc/sudoers.d/classpi <<SUDO
$TARGET_USER ALL=(root) NOPASSWD: /usr/bin/systemctl reboot, /usr/bin/systemctl poweroff, /usr/bin/systemctl stop classpi-kiosk.service, /usr/bin/systemctl start getty@tty1.service
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
echo "  Teacher PIN : $TEACHER_PIN   (change any time in $CONFIG_FILE)"
echo
echo "  For the Network Lab, install ClassPi on each Pi and wire them together."
echo "  On the sender's screen open Network Lab and enter the other Pis' addresses."
echo
say "Reboot now to start in kiosk mode:  ${BOLD}sudo reboot${NC}"
