#!/usr/bin/env python3
"""ClassPi OS - local app server.

Serves the launcher and classroom apps on 127.0.0.1 and provides a small API:
  /api/info            device + config info for the launcher
  /api/run             run pupil Python code in a sandboxed subprocess
  /api/files           list / load / save pupil work files
  /api/quiz            quiz question bank
  /api/system          live Pi stats (temp, CPU, memory, disk, IP)
  /api/system/action   reboot / shutdown / exit kiosk (teacher PIN required)
"""
import base64
import hashlib
import hmac
import json
import os
import re
import resource
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

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


def _ip_address():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "not connected"
    finally:
        s.close()


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


ACTIONS = {
    "reboot": ["sudo", "-n", "/usr/bin/systemctl", "reboot"],
    "shutdown": ["sudo", "-n", "/usr/bin/systemctl", "poweroff"],
    # Stop the kiosk service (killing cage directly would just get it
    # restarted by systemd) and bring the tty1 login prompt back.
    "exit_kiosk": ["sh", "-c",
                   "sudo -n /usr/bin/systemctl stop classpi-kiosk.service; "
                   "sudo -n /usr/bin/systemctl start getty@tty1.service"],
}


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


# ---------------------------------------------------------------- network lab
# Ciphers, from classical (weak - the middle can break these) to modern (strong).
SCHEME_META = {
    "none":     {"label": "No encryption (plaintext)", "strength": "none"},
    "caesar":   {"label": "Caesar shift",              "strength": "classical"},
    "vigenere": {"label": "Vigenere cipher",           "strength": "classical"},
    "pigpen":   {"label": "Pigpen cipher",             "strength": "classical"},
    "modern":   {"label": "Modern encryption (AES)",   "strength": "modern"},
}


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
    key = "".join(c for c in key.upper() if c.isalpha()) or "KEY"
    out, ki = [], 0
    for ch in text:
        if ch.isalpha():
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
        scheme = m.get("scheme", "none")
        m["strength"] = SCHEME_META.get(scheme, SCHEME_META["none"])["strength"]
        if scheme == "modern" and as_middle:
            # The interceptor does not hold the pre-shared key - it cannot read this.
            m["plain"] = None
        elif scheme == "modern":
            m["plain"] = decrypt_message(m.get("payload", ""), CONFIG["net_key"])
        else:
            m["plain"] = cipher_apply(m.get("payload", ""), scheme, m.get("params", {}), decrypt=True)
    return jsonify(data)


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

    scheme = d.get("scheme", "none")
    if scheme not in SCHEME_META:
        scheme = "none"
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

    envelope = {"payload": payload, "scheme": scheme, "params": params, "from": socket.gethostname()}
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
