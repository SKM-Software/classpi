#!/usr/bin/env python3
"""ClassPi Network Node - runs on every Pi in the Network Lab demo.

This is a small, deliberately simple service that listens on the LAN so the
teacher's control panel can show how a message travels between machines.

Roles are not fixed: any node can receive a message (/message) or act as a
relay in the middle (/relay). A relay only ever sees traffic that the sender
deliberately routes through it - it does not sniff or intercept anyone else's
traffic. That keeps the demo an honest illustration of the man-in-the-middle
*idea* for the classroom, not a tool for attacking a real network.

Binds to 0.0.0.0 so peers can reach it. Store is in memory only.
"""
import json
import os
import socket
import time
from collections import deque

import requests
from flask import Flask, jsonify, request


def _port():
    """CLASSPI_NET_PORT wins; otherwise use net_port from the shared config."""
    env = os.environ.get("CLASSPI_NET_PORT")
    if env:
        return int(env)
    try:
        with open(os.environ.get("CLASSPI_CONFIG", "/etc/classpi/config.json")) as f:
            return int(json.load(f).get("net_port", 8090))
    except (OSError, ValueError, json.JSONDecodeError):
        return 8090


PORT = _port()
inbox = deque(maxlen=50)   # messages delivered to this node (as receiver)
seen = deque(maxlen=50)    # messages this node forwarded (as relay)

app = Flask(__name__)


LAB_ADDRESSES = ("10.0.0.1", "10.0.0.2", "10.0.0.3")   # sender, middle, receiver


def _source_ip(target):
    """The address this node would send from to reach target (nothing is sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect((target, 1))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def _ip():
    # In the direct-cable lab the wired port is never the default route, so
    # look for the fixed lab address before falling back to the usual one.
    lab = _source_ip("10.0.0.254")
    if lab in LAB_ADDRESSES:
        return lab
    return _source_ip("10.255.255.255") or "127.0.0.1"


@app.get("/whoami")
def whoami():
    return jsonify(ok=True, hostname=socket.gethostname(), ip=_ip(), node="classpi", port=PORT)


def _record(d):
    return {
        "payload": str(d.get("payload", "")),
        "scheme": str(d.get("scheme", "none")),
        "params": d.get("params", {}) if isinstance(d.get("params"), dict) else {},
        # Which app skin the sender used, so the receiver can match it. The
        # node just stores it; the control panel validates it against a list.
        "theme": str(d.get("theme", "classic"))[:24],
        "from": str(d.get("from", "?")),
        "at": time.time(),
    }


@app.post("/message")
def message():
    """Deliver a message to this node acting as the receiver."""
    inbox.appendleft(_record(request.get_json(silent=True) or {}))
    return jsonify(ok=True)


@app.post("/relay")
def relay():
    """Sit in the middle: record what is visible, then forward to the next hop."""
    d = request.get_json(silent=True) or {}
    rec = _record(d)
    seen.appendleft(rec)
    nxt = d.get("next")
    forwarded = False
    error = None
    if nxt:
        try:
            requests.post(f"http://{nxt}:{PORT}/message",
                          json={"payload": rec["payload"], "scheme": rec["scheme"],
                                "params": rec["params"], "theme": rec["theme"],
                                "from": rec["from"]},
                          timeout=3)
            forwarded = True
        except requests.RequestException as exc:
            error = str(exc)
    return jsonify(ok=True, forwarded=forwarded, error=error)


@app.get("/inbox")
def get_inbox():
    return jsonify(ok=True, messages=list(inbox))


@app.get("/seen")
def get_seen():
    return jsonify(ok=True, messages=list(seen))


@app.post("/clear")
def clear():
    inbox.clear()
    seen.clear()
    return jsonify(ok=True)


if __name__ == "__main__":
    print(f"[classpi-net] node listening on 0.0.0.0:{PORT} ({socket.gethostname()} / {_ip()})")
    try:
        from waitress import serve
        serve(app, host="0.0.0.0", port=PORT, threads=4)
    except ImportError:
        app.run(host="0.0.0.0", port=PORT, threaded=True)
