#!/usr/bin/env python3
"""ClassPi OS - local app server.

Serves the launcher and classroom apps on 127.0.0.1 and provides a small API:
  /api/info            device + config info for the launcher
  /api/run             run pupil Python code in a sandboxed subprocess
  /api/files           list / load / save pupil work files
  /api/quiz            quiz question bank
  /api/system          live Pi stats (temp, CPU, memory, disk, IP)
  /api/system/action   reboot / shutdown / exit kiosk (teacher PIN required)
  /api/browser         open / close a real Chromium window on the kiosk screen
  /api/wifi            status, scan, connect / forget (teacher PIN to change)
  /api/internet        online / captive portal (needs sign-in) / offline
"""
import base64
import concurrent.futures
import hashlib
import hmac
import json
import os
import re
import resource
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from urllib.parse import urljoin

from flask import Flask, jsonify, request, send_from_directory, abort

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
DATA_DIR = APP_DIR / "data"
CONFIG_PATH = Path(os.environ.get("CLASSPI_CONFIG", "/etc/classpi/config.json"))

DEFAULT_CONFIG = {
    "device_name": "ClassPi",
    "school_name": "Computing Science",
    "teacher_pin": "1234",
    "host": "127.0.0.1",
    "port": 8080,
    "work_dir": str(Path.home() / "ClassPi-Work"),
    "run_timeout_seconds": 5,
    "net_port": 8090,
    "net_key": "clyde-kelvin",
    "repo_dir": "",
    # Web browser tile: a separate Chromium window with a normal address bar.
    "browser_enabled": True,
    "browser_search": "https://duckduckgo.com/?kp=1&q=",   # kp=1: strict safe search
    "browser_links": [
        {"name": "BBC Bitesize", "url": "https://www.bbc.co.uk/bitesize"},
        {"name": "SQA", "url": "https://www.sqa.org.uk"},
        {"name": "W3Schools", "url": "https://www.w3schools.com"},
        {"name": "Python docs", "url": "https://docs.python.org/3/"},
        {"name": "Wikipedia", "url": "https://en.wikipedia.org"},
        {"name": "Scratch", "url": "https://scratch.mit.edu"},
    ],
    # Regulatory domain applied when Wi-Fi is switched on from the System app.
    "wifi_country": "GB",
}

RUN_OUTPUT_LIMIT = 100_000  # characters
SAFE_NAME = re.compile(r"^[A-Za-z0-9 _\-]{1,60}\.py$")


def load_config():
    cfg = dict(DEFAULT_CONFIG)
    local = APP_DIR / "config.json"
    for path in (CONFIG_PATH, local):
        if path.exists():
            try:
                cfg.update(json.loads(path.read_text()))
                break
            except (OSError, json.JSONDecodeError) as exc:
                print(f"[classpi] could not read {path}: {exc}", file=sys.stderr)
    return cfg


CONFIG = load_config()
WORK_DIR = Path(CONFIG["work_dir"]).expanduser()
WORK_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=None)


@app.errorhandler(400)
@app.errorhandler(404)
@app.errorhandler(413)
def json_error(err):
    if request.path.startswith("/api/"):
        return jsonify(ok=False, error=getattr(err, "description", str(err))), err.code
    return err


# ---------------------------------------------------------------- static pages
@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/<path:path>")
def static_files(path):
    target = (STATIC_DIR / path).resolve()
    if not str(target).startswith(str(STATIC_DIR)) or not target.is_file():
        abort(404)
    resp = send_from_directory(STATIC_DIR, path)
    resp.headers["Cache-Control"] = "no-cache"
    return resp


# ---------------------------------------------------------------- info
@app.get("/api/info")
def info():
    return jsonify(
        device_name=CONFIG["device_name"],
        school_name=CONFIG["school_name"],
        hostname=socket.gethostname(),
        version="1.0",
    )


# ---------------------------------------------------------------- python runner
def _limit_child():
    """Resource limits applied inside the pupil's process before exec."""
    os.setsid()
    mem = 256 * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (mem, mem))
    cpu = int(CONFIG["run_timeout_seconds"]) + 1
    resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


@app.post("/api/run")
def run_code():
    payload = request.get_json(silent=True) or {}
    code = str(payload.get("code", ""))
    stdin_text = str(payload.get("stdin", ""))
    if len(code) > 50_000:
        return jsonify(ok=False, output="Program is too long (50,000 character limit).", seconds=0)

    timeout = float(CONFIG["run_timeout_seconds"])
    with tempfile.TemporaryDirectory(prefix="classpi-run-") as tmp:
        script = Path(tmp) / "main.py"
        script.write_text(code)
        env = {"PATH": "/usr/bin:/bin", "PYTHONIOENCODING": "utf-8", "HOME": tmp,
               "PYTHONDONTWRITEBYTECODE": "1"}
        start = time.monotonic()
        try:
            proc = subprocess.Popen(
                [sys.executable, "-I", "-u", str(script)],
                cwd=tmp, env=env,
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                preexec_fn=_limit_child, text=True,
            )
            try:
                out, _ = proc.communicate(stdin_text, timeout=timeout)
                timed_out = False
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(proc.pid, 9)
                except ProcessLookupError:
                    pass
                out, _ = proc.communicate()
                timed_out = True
        except OSError as exc:
            return jsonify(ok=False, output=f"Could not start Python: {exc}", seconds=0)
        elapsed = round(time.monotonic() - start, 3)

    out = (out or "").replace(str(script), "main.py")
    if len(out) > RUN_OUTPUT_LIMIT:
        out = out[:RUN_OUTPUT_LIMIT] + "\n... output cut short (too long) ..."
    if timed_out:
        out += f"\n\n[Stopped: your program ran for more than {timeout:g} seconds. Check for an infinite loop, or an input() with no input given.]"
    ok = (not timed_out) and proc.returncode == 0
    if proc.returncode and proc.returncode < 0 and not timed_out:
        out += "\n\n[Stopped: program used too much memory or CPU.]"
    return jsonify(ok=ok, output=out, seconds=elapsed, exit_code=proc.returncode)


# ---------------------------------------------------------------- pupil files
@app.get("/api/files")
def list_files():
    files = sorted(
        ({"name": p.name, "modified": int(p.stat().st_mtime)} for p in WORK_DIR.glob("*.py")),
        key=lambda f: -f["modified"],
    )
    return jsonify(files=files, folder=str(WORK_DIR))


def _safe_path(name):
    if not SAFE_NAME.match(name or ""):
        abort(400, "File names can use letters, numbers, spaces, - and _ and must end in .py")
    return WORK_DIR / name


@app.get("/api/files/<name>")
def load_file(name):
    path = _safe_path(name)
    if not path.exists():
        abort(404)
    return jsonify(name=name, code=path.read_text())


@app.post("/api/files/<name>")
def save_file(name):
    path = _safe_path(name)
    code = str((request.get_json(silent=True) or {}).get("code", ""))
    if len(code) > 200_000:
        abort(413)
    path.write_text(code)
    return jsonify(ok=True, name=name)


@app.delete("/api/files/<name>")
def delete_file(name):
    path = _safe_path(name)
    if path.exists():
        path.unlink()
    return jsonify(ok=True)


# ---------------------------------------------------------------- quiz
@app.get("/api/quiz")
def quiz():
    # A custom bank in the pupil work folder (or, for older installs, the
    # home folder) overrides the built-in questions.
    candidates = (WORK_DIR / "ClassPi-Quiz.json", WORK_DIR.parent / "ClassPi-Quiz.json")
    source = next((p for p in candidates if p.exists()), DATA_DIR / "quiz.json")
    try:
        return jsonify(json.loads(source.read_text()))
    except (OSError, json.JSONDecodeError):
        return jsonify(json.loads((DATA_DIR / "quiz.json").read_text()))


# ---------------------------------------------------------------- system panel
def _read(path, default=""):
    try:
        return Path(path).read_text().strip()
    except OSError:
        return default


def _source_ip(target):
    """The address this Pi would send from to reach target (nothing is sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect((target, 1))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def _ip_address():
    # The direct-cable lab port is never the default route (Wi-Fi keeps the
    # internet), so a default-route lookup alone would report the Wi-Fi
    # address instead - or nothing at all on an ethernet-only Pi.
    return _lab_ip() or _source_ip("10.255.255.255") or "not connected"


@app.get("/api/system")
def system():
    temp = _read("/sys/class/thermal/thermal_zone0/temp")
    temp_c = round(int(temp) / 1000, 1) if temp.isdigit() else None

    mem = {}
    for line in _read("/proc/meminfo").splitlines():
        key, _, val = line.partition(":")
        mem[key] = int(val.split()[0]) if val.split() else 0
    total = mem.get("MemTotal", 0)
    avail = mem.get("MemAvailable", 0)

    disk = shutil.disk_usage("/")
    uptime = float(_read("/proc/uptime", "0").split()[0])
    load = os.getloadavg()
    model = _read("/proc/device-tree/model", "").replace("\x00", "") or "Linux computer"

    return jsonify(
        model=model,
        hostname=socket.gethostname(),
        ip=_ip_address(),
        temp_c=temp_c,
        cpu_count=os.cpu_count(),
        load=[round(x, 2) for x in load],
        mem_total_mb=total // 1024,
        mem_used_mb=(total - avail) // 1024,
        disk_total_gb=round(disk.total / 1e9, 1),
        disk_used_gb=round(disk.used / 1e9, 1),
        uptime_seconds=int(uptime),
        python=sys.version.split()[0],
    )


# ---------------------------------------------------------------- updates
def _repo_dir():
    """The git clone this Pi was installed from (recorded by install.sh)."""
    d = str(CONFIG.get("repo_dir", "") or "").strip()
    repo = Path(d) if d else None
    return repo if repo and (repo / ".git").exists() else None


def _git(repo, *args, timeout=30):
    r = subprocess.run(["git", "-C", str(repo), *args],
                       capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout or "git failed").strip())
    return r.stdout.strip()


NOT_A_CLONE = ("This Pi was not installed from the GitHub clone, so it cannot "
               "update itself. See 'Updating a Pi' in the README.")


@app.get("/api/system/update/check")
def update_check():
    repo = _repo_dir()
    if not repo:
        return jsonify(ok=False, error=NOT_A_CLONE), 400
    try:
        _git(repo, "fetch", "--quiet", "origin")
        behind = int(_git(repo, "rev-list", "--count", "HEAD..@{u}"))
        current = _git(repo, "log", "-1", "--format=%h %s", "HEAD")
        latest = _git(repo, "log", "-1", "--format=%h %s", "@{u}")
    except subprocess.TimeoutExpired:
        return jsonify(ok=False, error="Timed out talking to GitHub - check the internet connection."), 502
    except (OSError, RuntimeError, ValueError) as exc:
        return jsonify(ok=False, error=str(exc)), 502
    return jsonify(ok=True, behind=behind, current=current, latest=latest)


@app.post("/api/system/update")
def update_apply():
    payload = request.get_json(silent=True) or {}
    pin = str(payload.get("pin", ""))
    if not hmac.compare_digest(pin, str(CONFIG["teacher_pin"])):
        time.sleep(1)
        return jsonify(ok=False, error="Wrong PIN"), 403
    repo = _repo_dir()
    if not repo:
        return jsonify(ok=False, error=NOT_A_CLONE), 400
    try:
        _git(repo, "pull", "--ff-only", timeout=60)
    except subprocess.TimeoutExpired:
        return jsonify(ok=False, error="Timed out pulling from GitHub."), 502
    except (OSError, RuntimeError) as exc:
        return jsonify(ok=False, error=str(exc)), 502
    # Root-side half (copy into /opt, restart services) - async so this
    # response gets out before the server restarts itself.
    try:
        subprocess.Popen(["sudo", "-n", "/usr/local/sbin/classpi-apply-update"],
                         start_new_session=True)
    except OSError as exc:
        return jsonify(ok=False, error=str(exc)), 500
    return jsonify(ok=True)


ACTIONS = {
    "reboot": ["sudo", "-n", "/usr/bin/systemctl", "reboot"],
    "shutdown": ["sudo", "-n", "/usr/bin/systemctl", "poweroff"],
    # Stop the kiosk service (killing cage directly would just get it
    # restarted by systemd) and bring the tty1 login prompt back.
    "exit_kiosk": ["sh", "-c",
                   "sudo -n /usr/bin/systemctl stop classpi-kiosk.service; "
                   "sudo -n /usr/bin/systemctl start getty@tty1.service"],
}


def _pin_ok(payload):
    """Constant-time teacher PIN check (callers sleep a second on failure)."""
    return hmac.compare_digest(str(payload.get("pin", "")), str(CONFIG["teacher_pin"]))


@app.post("/api/system/action")
def system_action():
    payload = request.get_json(silent=True) or {}
    pin = str(payload.get("pin", ""))
    action = payload.get("action")
    if not hmac.compare_digest(pin, str(CONFIG["teacher_pin"])):
        time.sleep(1)
        return jsonify(ok=False, error="Wrong PIN"), 403
    if action == "check":
        return jsonify(ok=True)
    if action not in ACTIONS:
        return jsonify(ok=False, error="Unknown action"), 400
    try:
        subprocess.Popen(ACTIONS[action], start_new_session=True)
    except OSError as exc:
        return jsonify(ok=False, error=str(exc)), 500
    return jsonify(ok=True)


# ---------------------------------------------------------------- web browser
# The kiosk Chromium has no address bar, so the Browser tile starts a second
# Chromium with its own profile on the same cage display. Cage shows every
# window maximised with the newest on top, so closing the browser lands back
# on the launcher. Chromium policies written by install.sh lock it down for a
# classroom and add a "ClassPi" bookmark that leads back to the start page.
BROWSER_PROFILE = Path.home() / ".config" / "classpi-browser"
BROWSER_POLICY = "/etc/chromium/policies/managed/classpi.json"
_browser = {"proc": None}


def _browser_start():
    return f"http://127.0.0.1:{int(CONFIG['port'])}/browser.html"


def _chromium():
    return shutil.which("chromium") or shutil.which("chromium-browser")


def _display_env():
    """Environment that puts a new window on the kiosk's Wayland display.

    kiosk.sh records cage's socket name in the runtime dir; a kiosk script
    from before that existed did not, so fall back to the first socket there.
    """
    env = dict(os.environ)
    runtime = env.get("XDG_RUNTIME_DIR") or f"/run/user/{os.getuid()}"
    env["XDG_RUNTIME_DIR"] = runtime
    display = env.get("WAYLAND_DISPLAY") or _read(Path(runtime) / "classpi-wayland")
    if not display:
        socks = sorted(p.name for p in Path(runtime).glob("wayland-*") if not p.name.endswith(".lock"))
        display = socks[0] if socks else ""
    if not display:
        return None
    env["WAYLAND_DISPLAY"] = display
    return env


def _browser_running():
    p = _browser["proc"]
    return p is not None and p.poll() is None


@app.get("/api/browser/status")
def browser_status():
    return jsonify(
        ok=True,
        enabled=bool(CONFIG.get("browser_enabled", True)),
        running=_browser_running(),
        chromium=bool(_chromium()),
        display=_display_env() is not None,
        locked_down=os.path.exists(BROWSER_POLICY),
        search=str(CONFIG.get("browser_search") or DEFAULT_CONFIG["browser_search"]),
        links=[l for l in (CONFIG.get("browser_links") or []) if isinstance(l, dict) and l.get("url")],
    )


@app.post("/api/browser/open")
def browser_open():
    d = request.get_json(silent=True) or {}
    if d.get("portal") and _net["state"] == "portal":
        # Signing in to a Wi-Fi portal is the only way this Pi gets online,
        # so allow it even with the browser tile switched off - but only to
        # the page the Pi detected itself, not one the caller chose.
        url = _net["portal_url"] or PORTAL_PROBES[0][0]
    elif not CONFIG.get("browser_enabled", True):
        return jsonify(ok=False, error="The web browser is switched off in this Pi's settings."), 403
    else:
        url = str(d.get("url", "")).strip()
        if not re.match(r"^https?://", url):
            url = _browser_start()
    exe = _chromium()
    if not exe:
        return jsonify(ok=False, error="Chromium is not installed on this computer."), 500
    env = _display_env()
    if not env:
        return jsonify(ok=False, error="No screen to open a window on - is the kiosk running?"), 500
    cmd = [exe, "--ozone-platform=wayland", f"--user-data-dir={BROWSER_PROFILE}",
           "--no-first-run", "--no-default-browser-check", "--password-store=basic",
           "--disable-features=TranslateUI", "--check-for-update-interval=31536000",
           "--start-maximized", "--new-window", url]
    try:
        proc = subprocess.Popen(cmd, env=env, start_new_session=True, stdin=subprocess.DEVNULL,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as exc:
        return jsonify(ok=False, error=str(exc)), 500
    # A second launch just hands its URL to the running browser and exits, so
    # keep tracking the first process - that is the one to close later.
    if not _browser_running():
        _browser["proc"] = proc
    return jsonify(ok=True, url=url)


@app.post("/api/browser/close")
def browser_close():
    p = _browser["proc"]
    if p is not None and p.poll() is None:
        try:
            os.killpg(p.pid, signal.SIGTERM)   # the whole tree: renderers, gpu, ...
        except ProcessLookupError:
            pass
    # Also catch a browser left over from before the server last restarted.
    subprocess.run(["pkill", "-f", f"user-data-dir={BROWSER_PROFILE}"], capture_output=True)
    _browser["proc"] = None
    return jsonify(ok=True)


# ---------------------------------------------------------------- internet / captive portal
# Public Wi-Fi (cafes, hotels, Wifinity...) lets the Pi join, then hijacks
# web traffic until someone accepts terms on a sign-in page. Desktop OSes
# notice and pop that page up; a kiosk never would. So ask a plain-HTTP URL
# whose true answer is known: a portal cannot fake it, and usually redirects
# to its own sign-in page instead, which tells us where to send the browser.
PORTAL_PROBES = (
    ("http://connectivitycheck.gstatic.com/generate_204", 204, None),
    ("http://nmcheck.gnome.org/check_network_status.txt", 200, "NetworkManager is online"),
)
_net = {"state": "unknown", "portal_url": None, "at": 0.0, "busy": False}
_net_lock = threading.Lock()


def _probe_internet():
    """Return (state, portal_url) with state one of online, portal, offline."""
    if not requests:
        return "unknown", None
    for url, want_status, want_text in PORTAL_PROBES:
        try:
            r = requests.get(url, allow_redirects=False, timeout=(4, 5),
                             headers={"Cache-Control": "no-cache"})
        except requests.RequestException:
            continue   # blocked or unreachable - try the next probe
        if r.status_code == want_status and (want_text is None or want_text in r.text):
            return "online", None
        if 300 <= r.status_code < 400:
            loc = urljoin(url, r.headers.get("Location", ""))
            return "portal", loc if re.match(r"^https?://", loc) else url
        return "portal", url   # the portal served its own page in place of the answer
    return "offline", None


def _refresh_internet():
    try:
        state, portal = _probe_internet()
    except Exception:   # never let a probe take the flag down with it
        state, portal = "unknown", None
    with _net_lock:
        _net.update(state=state, portal_url=portal, at=time.time(), busy=False)


def _internet(max_age=None, wait=0.0):
    """Cached connectivity state. A stale value starts a probe in the
    background: behind a portal even a DNS lookup can hang for many seconds,
    and that must never hold up a page that is only asking."""
    if max_age is None:
        max_age = 60 if _net["state"] == "online" else 10
    with _net_lock:
        if time.time() - _net["at"] > max_age and not _net["busy"]:
            _net["busy"] = True
            threading.Thread(target=_refresh_internet, daemon=True).start()
    deadline = time.time() + wait
    while _net["busy"] and time.time() < deadline:
        time.sleep(0.2)
    with _net_lock:
        return dict(_net)


def _internet_now(wait=10.0):
    """A fresh result after the network changed: let any probe already in
    flight (which may predate the change) finish, then run a new one."""
    deadline = time.time() + wait
    while _net["busy"] and time.time() < deadline:
        time.sleep(0.2)
    return _internet(max_age=0, wait=max(0.0, deadline - time.time()))


@app.get("/api/internet")
def internet():
    n = _internet()
    return jsonify(ok=True, state=n["state"], portal_url=n["portal_url"], checked=int(n["at"]))


# ---------------------------------------------------------------- wi-fi
# Reading is done here with nmcli as the app user; anything that changes the
# network goes through the root-owned classpi-wifi helper (sudoers, no password).
WIFI_HELPER = "/usr/local/sbin/classpi-wifi"


def _nmcli(*args, timeout=15):
    r = subprocess.run(["nmcli", "-t", *args], capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout or "nmcli failed").strip())
    return r.stdout


def _nm_split(line):
    """Split one terse nmcli line on ':' - values escape their own ':' as '\\:'."""
    out, cur, i = [], [], 0
    while i < len(line):
        c = line[i]
        if c == "\\" and i + 1 < len(line):
            cur.append(line[i + 1])
            i += 2
            continue
        if c == ":":
            out.append("".join(cur))
            cur = []
        else:
            cur.append(c)
        i += 1
    out.append("".join(cur))
    return out


def _rfkill_blocked():
    """True when the radio is off in software or by a switch. A fresh Pi OS
    image keeps Wi-Fi blocked until a country has been set."""
    try:
        for d in Path("/sys/class/rfkill").iterdir():
            if _read(d / "type") == "wlan" and (_read(d / "soft") == "1" or _read(d / "hard") == "1"):
                return True
    except OSError:
        pass
    return False


def _wifi_device():
    for line in _nmcli("-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status").splitlines():
        f = _nm_split(line)
        if len(f) >= 4 and f[1] == "wifi":
            return {"device": f[0], "state": f[2], "profile": f[3]}
    return None


def _saved_networks():
    """SSIDs with a saved profile (nmcli names profiles after the SSID, but
    Raspberry Pi Imager's is called 'preconfigured', so look inside each)."""
    ssids = set()
    for line in _nmcli("-f", "NAME,TYPE", "connection", "show").splitlines():
        f = _nm_split(line)
        if len(f) >= 2 and f[1] == "802-11-wireless":
            try:
                ssid = _nmcli("-g", "802-11-wireless.ssid", "connection", "show", f[0]).strip()
            except (RuntimeError, subprocess.TimeoutExpired):
                continue
            ssids.add(ssid.replace("\\:", ":") or f[0])
    return ssids


def _wifi_scan(rescan):
    fields = ("-f", "ACTIVE,SSID,SIGNAL,SECURITY", "device", "wifi", "list")
    try:
        raw = _nmcli(*fields, "--rescan", "yes" if rescan else "no", timeout=25)
    except (RuntimeError, subprocess.TimeoutExpired):
        if not rescan:
            raise
        raw = _nmcli(*fields, "--rescan", "no")   # cached results beat nothing
    nets = {}
    for line in raw.splitlines():
        f = _nm_split(line)
        if len(f) < 4 or not f[1]:
            continue   # hidden networks have no name to show
        active, ssid, sec = f[0] == "yes", f[1], f[3].strip()
        try:
            signal_pct = int(f[2] or 0)
        except ValueError:
            signal_pct = 0
        prev = nets.get(ssid)
        if prev and prev["signal"] >= signal_pct and not active:
            continue   # same network on another access point - keep the strongest
        sec = "" if sec == "--" else sec
        nets[ssid] = {"ssid": ssid, "signal": signal_pct, "security": sec, "secure": bool(sec),
                      "enterprise": "802.1X" in sec, "active": active or bool(prev and prev["active"])}
    return sorted(nets.values(), key=lambda n: (not n["active"], -n["signal"], n["ssid"].lower()))


def _wifi_helper(*args, input_text="", timeout=75):
    if not os.path.exists(WIFI_HELPER):
        raise RuntimeError("This Pi was set up before Wi-Fi settings existed - re-run install.sh.")
    done = subprocess.run(["sudo", "-n", WIFI_HELPER, *args], input=input_text,
                          capture_output=True, text=True, timeout=timeout)
    if done.returncode != 0:
        raise RuntimeError((done.stderr or done.stdout or "Could not change the Wi-Fi").strip())
    return done.stdout.strip()


def _wifi_error(msg):
    low = msg.lower()
    if "secrets were required" in low or "no secrets" in low:
        return "Wrong password (or this network needs a username as well)."
    if "no network with ssid" in low or "not found" in low:
        return "Network not found - is it in range, and is the name exactly right?"
    return msg


@app.get("/api/wifi/status")
def wifi_status():
    helper = os.path.exists(WIFI_HELPER)
    if not shutil.which("nmcli"):
        return jsonify(ok=True, radio="none", available=helper,
                       error="NetworkManager is not installed on this computer.")
    try:
        dev = _wifi_device()
        if not dev:
            return jsonify(ok=True, radio="none", available=helper, error="No Wi-Fi hardware found.")
        if _rfkill_blocked():
            radio = "blocked"
        elif _nmcli("radio", "wifi").strip() != "enabled":
            radio = "off"
        else:
            radio = "on"
        connected = None
        if dev["state"].startswith("connected"):
            ip = _nmcli("-g", "IP4.ADDRESS", "device", "show", dev["device"]).strip()
            ip = ip.split("|")[0].strip().split("/")[0]
            active = next((n for n in _wifi_scan(rescan=False) if n["active"]), None)
            connected = {"ssid": active["ssid"] if active else dev["profile"],
                         "signal": active["signal"] if active else None, "ip": ip}
        net = _internet()
        return jsonify(ok=True, radio=radio, device=dev["device"], state=dev["state"],
                       connected=connected, saved=sorted(_saved_networks(), key=str.lower),
                       available=helper, country=str(CONFIG.get("wifi_country") or "GB"),
                       internet=net["state"], portal_url=net["portal_url"])
    except (RuntimeError, subprocess.TimeoutExpired, OSError) as exc:
        return jsonify(ok=False, error=str(exc)), 500


@app.post("/api/wifi/scan")
def wifi_scan():
    if not shutil.which("nmcli"):
        return jsonify(ok=False, error="NetworkManager is not installed on this computer."), 500
    try:
        nets = _wifi_scan(rescan=True)
        saved = _saved_networks()
    except (RuntimeError, subprocess.TimeoutExpired, OSError) as exc:
        return jsonify(ok=False, error=str(exc)), 500
    for n in nets:
        n["saved"] = n["ssid"] in saved
    return jsonify(ok=True, networks=nets)


@app.post("/api/wifi/connect")
def wifi_connect():
    d = request.get_json(silent=True) or {}
    if not _pin_ok(d):
        time.sleep(1)
        return jsonify(ok=False, error="Wrong PIN"), 403
    ssid = str(d.get("ssid", "")).strip()[:32]
    if not ssid:
        return jsonify(ok=False, error="Enter the network name"), 400
    # The helper reads these from stdin, one per line, so they never appear
    # in a process list: the password first, then a username for 802.1X.
    password = str(d.get("password", "")).replace("\n", "")[:128]
    username = str(d.get("username", "")).replace("\n", "")[:128]
    args = ["connect", ssid] + (["hidden"] if d.get("hidden") else [])
    try:
        msg = _wifi_helper(*args, input_text=f"{password}\n{username}\n")
    except subprocess.TimeoutExpired:
        return jsonify(ok=False, error="Timed out connecting - check the password and try again."), 504
    except (OSError, RuntimeError) as exc:
        return jsonify(ok=False, error=_wifi_error(str(exc))), 500
    net = _internet_now()
    return jsonify(ok=True, message=msg, ip=_ip_address(),
                   internet=net["state"], portal_url=net["portal_url"])


@app.post("/api/wifi/forget")
def wifi_forget():
    d = request.get_json(silent=True) or {}
    if not _pin_ok(d):
        time.sleep(1)
        return jsonify(ok=False, error="Wrong PIN"), 403
    ssid = str(d.get("ssid", "")).strip()[:32]
    if not ssid:
        return jsonify(ok=False, error="Enter the network name"), 400
    try:
        msg = _wifi_helper("forget", ssid, timeout=30)
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
        return jsonify(ok=False, error=str(exc)), 500
    return jsonify(ok=True, message=msg)


@app.post("/api/wifi/on")
def wifi_on():
    d = request.get_json(silent=True) or {}
    if not _pin_ok(d):
        time.sleep(1)
        return jsonify(ok=False, error="Wrong PIN"), 403
    country = str(CONFIG.get("wifi_country") or "GB").strip().upper()
    if not re.match(r"^[A-Z]{2}$", country):
        country = "GB"
    try:
        msg = _wifi_helper("on", country, timeout=40)
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
        return jsonify(ok=False, error=str(exc)), 500
    return jsonify(ok=True, message=msg)


# ---------------------------------------------------------------- network lab
# Ciphers, from classical (weak - the middle can break these) to modern (strong).
SCHEME_META = {
    "none":     {"label": "No encryption (plaintext)", "strength": "none"},
    "caesar":   {"label": "Caesar shift",              "strength": "classical"},
    "vigenere": {"label": "Vigenere cipher",           "strength": "classical"},
    "pigpen":   {"label": "Pigpen cipher",             "strength": "classical"},
    "modern":   {"label": "Modern encryption (AES)",   "strength": "modern"},
}

# App skins for the sender/receiver screens (the middle screen is never themed).
NET_THEMES = {"classic", "whatsapp", "messenger", "sms", "email", "login", "banking"}


def _caesar(text, shift, decrypt=False):
    if decrypt:
        shift = -shift
    out = []
    for ch in text:
        if "a" <= ch <= "z":
            out.append(chr((ord(ch) - 97 + shift) % 26 + 97))
        elif "A" <= ch <= "Z":
            out.append(chr((ord(ch) - 65 + shift) % 26 + 65))
        else:
            out.append(ch)
    return "".join(out)


def _vigenere(text, key, decrypt=False):
    # A-Z only, like _caesar: the shift maths is ASCII, so letting accented
    # characters through here would corrupt them instead of passing them on.
    key = "".join(c for c in key.upper() if "A" <= c <= "Z") or "KEY"
    out, ki = [], 0
    for ch in text:
        if "a" <= ch <= "z" or "A" <= ch <= "Z":
            k = ord(key[ki % len(key)]) - 65
            if decrypt:
                k = -k
            base = 97 if ch.islower() else 65
            out.append(chr((ord(ch) - base + k) % 26 + base))
            ki += 1
        else:
            out.append(ch)
    return "".join(out)


def _derive_key(passphrase):
    return base64.urlsafe_b64encode(hashlib.sha256(passphrase.encode()).digest())


def encrypt_message(text, passphrase):
    """Return (ciphertext_string, scheme). Real AES via Fernet when available."""
    try:
        from cryptography.fernet import Fernet
        token = Fernet(_derive_key(passphrase)).encrypt(text.encode())
        return token.decode(), "AES (Fernet)"
    except Exception:
        # Fallback so the demo still runs if 'cryptography' is missing.
        key = hashlib.sha256(passphrase.encode()).digest()
        raw = text.encode()
        xored = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
        return base64.urlsafe_b64encode(xored).decode(), "XOR (demo fallback)"


def decrypt_message(token, passphrase):
    try:
        from cryptography.fernet import Fernet
        return Fernet(_derive_key(passphrase)).decrypt(token.encode()).decode()
    except Exception:
        try:
            key = hashlib.sha256(passphrase.encode()).digest()
            raw = base64.urlsafe_b64decode(token.encode())
            return bytes(b ^ key[i % len(key)] for i, b in enumerate(raw)).decode()
        except Exception:
            return "(could not decrypt - wrong key?)"


def cipher_apply(text, scheme, params, decrypt=False):
    """Encode (or decode) text with the chosen cipher. Pigpen is a 1:1 letter
    substitution with no key, so it is identity here - the symbols are drawn on
    screen. Its 'security' is only obscurity, which is the teaching point."""
    if scheme == "caesar":
        return _caesar(text, int(params.get("shift", 3)), decrypt)
    if scheme == "vigenere":
        return _vigenere(text, str(params.get("vkey", "SCHOOL")), decrypt)
    if scheme == "pigpen":
        return text
    if scheme == "modern":
        key = CONFIG["net_key"]  # pre-shared, set at install - never travels
        return decrypt_message(text, key) if decrypt else encrypt_message(text, key)[0]
    return text


def _node(ip, path, method="get", **kw):
    if not requests:
        raise RuntimeError("The 'requests' library is not installed on this Pi.")
    url = f"http://{ip}:{int(CONFIG['net_port'])}{path}"
    fn = requests.post if method == "post" else requests.get
    return fn(url, timeout=3, **kw).json()


@app.post("/api/net/peek")
def net_peek():
    d = request.get_json(silent=True) or {}
    ip = str(d.get("ip", "")).strip()
    kind = "seen" if d.get("kind") == "seen" else "inbox"
    as_middle = bool(d.get("as_middle"))
    if not re.match(r"^[\w.\-]{1,60}$", ip):
        return jsonify(ok=False, error="Enter a valid address"), 400
    try:
        data = _node(ip, "/" + kind)
    except Exception as exc:
        return jsonify(ok=False, error=str(exc)), 502
    # Work out the readable form of each message for display.
    for m in data.get("messages", []):
        scheme = str(m.get("scheme", "none"))
        m["strength"] = SCHEME_META.get(scheme, SCHEME_META["none"])["strength"]
        # Messages arrive from a LAN-reachable port, so pin the theme to a
        # known value before the browser uses it to pick a renderer.
        if str(m.get("theme")) not in NET_THEMES:
            m["theme"] = "classic"
        if scheme == "modern" and as_middle:
            # The interceptor does not hold the pre-shared key - it cannot read this.
            m["plain"] = None
        elif scheme == "modern":
            m["plain"] = decrypt_message(m.get("payload", ""), CONFIG["net_key"])
        else:
            m["plain"] = cipher_apply(m.get("payload", ""), scheme, m.get("params", {}), decrypt=True)
    return jsonify(data)


# ---------------------------------------------------------------- lab network
LAB_MODES = {"sender": "10.0.0.1", "middle": "10.0.0.2", "receiver": "10.0.0.3"}
LAB_PROBE = "10.0.0.254"   # any host on the lab subnet (not its broadcast address)
LABNET = "/usr/local/sbin/classpi-labnet"


def _lab_ip():
    """This Pi's direct-cable address, if classpi-labnet has given it one."""
    ip = _source_ip(LAB_PROBE)
    return ip if ip in LAB_MODES.values() else None


def _eth_devices():
    """Wired network ports on this Pi (so we know if a second one is plugged in)."""
    try:
        names = sorted(os.listdir("/sys/class/net"))
    except OSError:
        return []
    skip = ("lo", "wlan", "br", "veth", "docker", "tun", "tap")
    return [n for n in names if not n.startswith(skip)]


@app.get("/api/net/labmode")
def lab_mode():
    lab = _lab_ip()
    mode = next((m for m, addr in LAB_MODES.items() if addr == lab), "normal")
    eths = _eth_devices()
    return jsonify(
        ok=True, mode=mode, ip=lab or _ip_address(), addresses=LAB_MODES,
        eth_count=len(eths), eths=eths,
        available=os.path.exists(LABNET),
    )


@app.post("/api/net/labmode")
def set_lab_mode():
    payload = request.get_json(silent=True) or {}
    if not hmac.compare_digest(str(payload.get("pin", "")), str(CONFIG["teacher_pin"])):
        time.sleep(1)
        return jsonify(ok=False, error="Wrong PIN"), 403
    mode = str(payload.get("mode", ""))
    if mode not in LAB_MODES and mode != "normal":
        return jsonify(ok=False, error="Unknown mode"), 400
    if not os.path.exists(LABNET):
        return jsonify(ok=False, error="This Pi was set up before lab mode existed - re-run install.sh."), 400
    try:
        done = subprocess.run(["sudo", "-n", LABNET, mode],
                              capture_output=True, text=True, timeout=45)
    except subprocess.TimeoutExpired:
        return jsonify(ok=False, error="The network change took too long - check the cable is in, then press the button again."), 504
    except OSError as exc:
        return jsonify(ok=False, error=str(exc)), 500
    if done.returncode != 0:
        return jsonify(ok=False, error=(done.stderr or done.stdout or "Could not change the network").strip()), 500
    return jsonify(ok=True, mode=mode, message=done.stdout.strip(), ip=_ip_address())


@app.post("/api/net/discover")
def net_discover():
    """Find the other ClassPis on this network so nobody has to type an IP.

    Looks at every address on this Pi's own /24 and asks anything answering on
    the Network Lab port to identify itself. One port, one subnet, our own
    service - just enough to fill in the address boxes.
    """
    me = _ip_address()
    if me == "not connected" or me.startswith("127."):
        return jsonify(ok=False, error="This Pi is not on a network yet - plug in ethernet or join the Wi-Fi."), 400
    if not requests:
        return jsonify(ok=False, error="The 'requests' library is not installed on this Pi."), 500
    port = int(CONFIG["net_port"])
    base = me.rsplit(".", 1)[0]

    def probe(n):
        ip = f"{base}.{n}"
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.4)
        try:
            if sock.connect_ex((ip, port)) != 0:
                return None
        except OSError:
            return None
        finally:
            sock.close()
        try:
            info = requests.get(f"http://{ip}:{port}/whoami", timeout=1.5).json()
        except Exception:
            return None
        if info.get("node") != "classpi":
            return None
        return {"ip": ip, "hostname": info.get("hostname") or ip, "self": ip == me}

    found = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=64) as pool:
        for result in pool.map(probe, range(1, 255)):
            if result:
                found.append(result)
    found.sort(key=lambda f: (not f["self"], f["hostname"]))
    return jsonify(ok=True, me=me, hostname=socket.gethostname(), port=port, found=found)


@app.post("/api/net/clear")
def net_clear():
    """Ask each listed node (usually this Pi, the receiver and the relay) to
    empty its inbox/seen lists."""
    d = request.get_json(silent=True) or {}
    ips = [str(i).strip() for i in (d.get("ips") or []) if str(i).strip()][:5]
    results = {}
    for ip in ips:
        if not re.match(r"^[\w.\-]{1,60}$", ip):
            results[ip] = "invalid address"
            continue
        try:
            _node(ip, "/clear", method="post")
            results[ip] = "cleared"
        except Exception as exc:
            results[ip] = str(exc)
    return jsonify(ok=True, results=results)


@app.post("/api/net/ping")
def net_ping():
    d = request.get_json(silent=True) or {}
    ip = str(d.get("ip", "")).strip()
    if not re.match(r"^[\w.\-]{1,60}$", ip):
        return jsonify(ok=False, error="Enter a valid address"), 400
    try:
        return jsonify(ok=True, node=_node(ip, "/whoami"))
    except Exception as exc:
        return jsonify(ok=False, error=str(exc)), 502


@app.post("/api/net/send")
def net_send():
    """Route a message sender -> (relay) -> receiver and return the full trace."""
    d = request.get_json(silent=True) or {}
    text = str(d.get("message", ""))[:2000]
    receiver = str(d.get("receiver", "")).strip()
    relay = str(d.get("relay", "")).strip()
    simulate = bool(d.get("simulate"))

    # str() first: a JSON object/array here is unhashable and would otherwise
    # blow up the membership test.
    scheme = str(d.get("scheme", "none"))
    if scheme not in SCHEME_META:
        scheme = "none"
    theme = str(d.get("theme", "classic"))
    if theme not in NET_THEMES:
        theme = "classic"
    # Classical parameters travel with the message (the algorithm is public;
    # only a modern key stays secret). Modern carries no key at all.
    params = {}
    if scheme == "caesar":
        try:
            params["shift"] = max(1, min(25, int(d.get("shift", 3))))
        except (TypeError, ValueError):
            params["shift"] = 3
    elif scheme == "vigenere":
        params["vkey"] = "".join(c for c in str(d.get("vkey", "SCHOOL")).upper() if c.isalpha()) or "SCHOOL"

    meta = SCHEME_META[scheme]
    payload = cipher_apply(text, scheme, params)
    receiver_reads = cipher_apply(payload, scheme, params, decrypt=True)

    trace = {
        "sent": text,
        "scheme": scheme,
        "theme": theme,
        "scheme_label": meta["label"],
        "strength": meta["strength"],
        "params": params,
        "on_wire": payload,
        "relay_can_read": (None if scheme == "modern" else payload),
        "delivered_payload": payload,
        "receiver_reads": receiver_reads,
    }

    if simulate:
        trace["mode"] = "simulation"
        return jsonify(ok=True, trace=trace)

    if not receiver:
        return jsonify(ok=False, error="Enter the receiver's address (or use Simulate)"), 400

    envelope = {"payload": payload, "scheme": scheme, "params": params,
                "theme": theme, "from": socket.gethostname()}
    try:
        if relay:
            r = _node(relay, "/relay", method="post", json={**envelope, "next": receiver})
            trace["relay_forwarded"] = r.get("forwarded")
            if r.get("error"):
                trace["relay_error"] = r["error"]
        else:
            _node(receiver, "/message", method="post", json=envelope)
        trace["mode"] = "live"
    except Exception as exc:
        return jsonify(ok=False, error=str(exc), trace=trace), 502
    return jsonify(ok=True, trace=trace)


if __name__ == "__main__":
    host, port = CONFIG["host"], int(CONFIG["port"])
    try:
        from waitress import serve
        print(f"[classpi] serving on http://{host}:{port} (waitress)")
        serve(app, host=host, port=port, threads=4)
    except ImportError:
        print(f"[classpi] serving on http://{host}:{port} (flask)")
        app.run(host=host, port=port, threaded=True)
