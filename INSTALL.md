# ClassPi OS — Install Guide

A start-to-finish walkthrough for setting up a ClassPi. No Linux experience
needed — every command you have to type is shown in full.

---

## What you need

- A **Raspberry Pi 5** (or Pi 4) with a power supply
- A **microSD card** (16 GB or larger) — or an SSD if the Pi boots from one
- An **HDMI monitor and a USB keyboard** (a mouse is optional — everything
  works from the keyboard)
- **Internet for the Pi** during installation: ethernet, or the school Wi-Fi
- A computer with [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
  installed, and a way to write the microSD card

---

## Step 1 — Flash the base image

1. Open **Raspberry Pi Imager** on your computer.
2. **Choose Device**: your Pi model.
3. **Choose OS**: *Raspberry Pi OS (other)* → **Raspberry Pi OS Lite (64-bit)**.
   Lite is correct — ClassPi replaces the desktop entirely.
4. **Choose Storage**: the microSD card.
5. Click **Next**, then **Edit Settings** when asked. Set:
   - **Hostname**: anything for now (the installer renames it later to match
     the device name you choose)
   - **Username / password**: e.g. `teacher` and a password you'll remember
   - **Wi-Fi**: SSID + password, and the Wi-Fi country — skip if using ethernet
   - **Services tab → Enable SSH** (password authentication) — strongly
     recommended, it makes updates and fixes much easier later
6. Write the card, then put it in the Pi.

> Don't try to copy ClassPi onto the card from Windows/macOS — the main
> partition is Linux-only and won't show up. Files go on **after** the Pi boots.

---

## Step 2 — First boot

Connect the monitor, keyboard and network, then power on. First boot takes a
minute or two and may reboot itself once. End result: a plain text login
prompt.

Log in with the username and password you set in the Imager.

*(Working from another computer instead? `ssh teacher@<hostname>.local` gets
you the same prompt.)*

---

## Step 3 — Get ClassPi onto the Pi

Recommended: straight from GitHub —

```bash
sudo apt install -y git
git clone https://github.com/SKM-Software/classpi.git
```

That creates a `classpi` folder in your home directory, and makes every
future update a one-button job.

<details>
<summary>Alternatives if the Pi has no internet yet (USB stick / SSH copy)</summary>

- **USB stick:** copy the `classpi` folder onto a FAT32/exFAT stick from any
  computer, plug it into the Pi, then:
  ```bash
  lsblk                              # find the stick, usually sda1
  sudo mount /dev/sda1 /mnt
  cp -r /mnt/classpi ~/
  sudo umount /mnt
  ```
- **Over SSH from your computer:**
  ```bash
  scp -r classpi teacher@<hostname>.local:~/
  ```

Note the installer itself still needs internet for packages. A USB-copied Pi
can be switched to GitHub updates later — see the README's
"Updating a Pi" section.
</details>

---

## Step 4 — Run the installer

```bash
cd ~/classpi
sudo bash install.sh
```

It asks four questions — press **Enter** to accept the default in brackets:

| Prompt | What it's for |
|---|---|
| **Device name** | Shown on screen and becomes the hostname (e.g. "Lab Pi 1" → `lab-pi-1`) |
| **School / department name** | Shown under the device name |
| **Teacher PIN** | Required for restart / shutdown / exit / installing updates |
| **Network Lab shared key** | The AES key for the encryption demo — use the **same key on every Pi** |

Then it installs packages (a few minutes), sets up the services, kiosk and
boot splash. When it finishes:

```bash
sudo reboot
```

> **Installing a whole classroom?** Skip the prompts:
> `sudo CLASSPI_NAME="Lab Pi 3" CLASSPI_PIN=4821 CLASSPI_NET_KEY=our-key bash install.sh`
>
> Re-running the installer later is always safe — it keeps the answers you
> gave the first time as the defaults.

---

## Step 5 — First look

The Pi boots through the SKM Software splash into the ClassPi desktop: a
taskbar with the **SKM Menu** button, the clock, and the tools in the menu.

Keyboard essentials (they're also shown on screen):

| Key | Does |
|---|---|
| **1–7** | Open a tool directly |
| **↑ ↓ + Enter** | Navigate the menu |
| **Esc** | Open/close the menu; inside a tool, return to the desktop |
| **Ctrl+Alt+F2** | Emergency terminal (log in; **Ctrl+Alt+F1** returns to ClassPi) |

Worth a 2-minute test: open **Python Lab** and run the "Hello, world" example,
then **System** to check temperature and that the update checker reaches
GitHub.

---

## Updating later

- **On the Pi:** System → **Software update** → *Check for updates* →
  *Install update* (teacher PIN). Done in seconds.
- **Over SSH:** `cd ~/classpi && sudo bash update.sh`
- If a release note says it changes packages/services/config:
  `cd ~/classpi && git pull && sudo bash install.sh` (Enter through the
  prompts), then reboot.

---

## Setting up the Network Lab (2–3 Pis)

1. Install ClassPi on each Pi **with the same shared key**, connected to the
   same network.
2. On each Pi, open **System** and note its IP address (or use
   `<device-name>.local`).
3. Pick roles: one **sender**, one **receiver**, optionally one **middle**.
   On each Pi open **Network Lab** and click that Pi's role at the top.
4. On the sender, open *Connect real Pis*, enter the receiver's (and relay's)
   address, and press *Test connections*.

Full teaching notes are in the [README](README.md#the-network-lab-1-2-or-3-pis).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Installer says it can't reach the internet | Plug in ethernet, or `sudo raspi-config` → Localisation → WLAN Country, then System → Wireless LAN. Re-run the installer. |
| Black screen after reboot | Wait 30 s (first kiosk start is slow). Then Ctrl+Alt+F2, log in, `systemctl status classpi-kiosk classpi` to see what failed. |
| Launcher shows but tools error | `journalctl -u classpi -e` for the server log. |
| Forgot the teacher PIN | Ctrl+Alt+F2, log in, `sudo nano /etc/classpi/config.json`, change `teacher_pin`, then `sudo systemctl restart classpi`. |
| Update button says "not installed from the GitHub clone" | The Pi was set up from a USB copy. Follow "Updating a Pi" in the README to switch it to the clone once. |
| Want the Pi back to normal | `cd ~/classpi && sudo bash uninstall.sh`, then reboot. |

Any other issue: `Ctrl+Alt+F2` always gets you a terminal, and
`journalctl -u classpi -e`, `journalctl -u classpi-net -e` and
`journalctl -u classpi-kiosk -e` show what each part is doing.
