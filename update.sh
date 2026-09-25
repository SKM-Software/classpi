#!/usr/bin/env bash
#
# ClassPi OS updater
# ------------------
# Pulls the latest ClassPi from git and applies it to this Pi.
# Run on the Pi, from the repo folder:  sudo bash update.sh
#
# Use this for day-to-day app changes. If an update changes packages,
# services or config, re-run the full installer instead:  sudo bash install.sh
# (it keeps your existing settings).
#
set -euo pipefail
BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; NC=$'\033[0m'
say()  { echo "${GREEN}${BOLD}==>${NC} $*"; }
warn() { echo "${YELLOW}${BOLD}!! ${NC} $*"; }

[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash update.sh"; exit 1; }
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SRC_DIR"
[[ -d /opt/classpi ]] || { echo "ClassPi is not installed yet - run: sudo bash install.sh"; exit 1; }

if [[ -d .git ]] && command -v git >/dev/null; then
  say "Pulling the latest changes..."
  # Run git as the checkout's owner so file ownership stays sane.
  OWNER="$(stat -c %U .)"
  sudo -u "$OWNER" git pull --ff-only || warn "git pull failed - applying the files already here."
else
  warn "Not a git checkout - applying the files already here."
fi

say "Copying the app into place..."
cp -r "$SRC_DIR/app/." /opt/classpi/
/opt/classpi/venv/bin/pip install --quiet -r /opt/classpi/requirements.txt

say "Restarting services..."
systemctl restart classpi classpi-net
systemctl try-restart classpi-kiosk 2>/dev/null || true

say "Done. The screen reloads in a few seconds."
