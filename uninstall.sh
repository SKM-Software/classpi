#!/usr/bin/env bash
# Remove ClassPi and return the Pi to a normal console/desktop boot.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash uninstall.sh"; exit 1; }

systemctl disable --now classpi-kiosk.service classpi.service classpi-net.service 2>/dev/null || true
rm -f /etc/systemd/system/classpi.service /etc/systemd/system/classpi-net.service /etc/systemd/system/classpi-kiosk.service
/usr/local/sbin/classpi-labnet normal 2>/dev/null || true   # restore normal networking
rm -f /etc/sudoers.d/classpi /usr/local/sbin/classpi-apply-update /usr/local/sbin/classpi-labnet /usr/local/sbin/classpi-wifi
rm -f /etc/chromium/policies/managed/classpi.json /etc/chromium-browser/policies/managed/classpi.json
systemctl daemon-reload
rm -rf /opt/classpi
echo "Removed ClassPi services and files."
echo "Left in place (delete by hand if you want): /etc/classpi, ~/ClassPi-Work, ~/.config/classpi-browser, the boot splash theme."
echo "If your image has a desktop, restore it with: sudo systemctl set-default graphical.target && sudo reboot"
