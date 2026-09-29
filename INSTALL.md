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

The Pi boots through the SKM Software splash into the ClassPi desktop: a top
panel with the **SKM Menu** button and clock, and the tools organised into
menu categories (Programming, Data, Networking, Revision, Classroom, System).

Keyboard essentials (they're also shown on screen):

| Key | Does |
|---|---|
| **1–8** | Open a tool directly, from anywhere |
| **↑ ↓** | Move through the menu |
| **→ / Enter** | Open a category's submenu; Enter on a tool launches it |
| **←** | Back out of a submenu |
| **Esc** | Open/close the menu; inside a tool, return to the desktop |
| **Ctrl+Alt+F2** | Emergency terminal (log in; **Ctrl+Alt+F1** returns to ClassPi) |

Worth a 2-minute test: open **Python Lab** and run the "Hello, world" example,
then **System** to check temperature and that the update checker reaches
GitHub.

---

## Wi-Fi and the web browser

- **Wi-Fi:** open **System** (key **7**) → **Wi-Fi** → *Scan for networks*,
  pick one, type the password and the teacher PIN. School networks that also
  need a username ask for both. If the panel says Wi-Fi is *blocked*, press
  **Turn Wi-Fi on** — it sets the country (`GB` unless changed in the config)
  and enables the radio.
- **Web Browser** (key **8**) opens a real Chromium window on top of ClassPi.
  Its start page has a search box and a **Back to ClassPi** button; the
  **ClassPi** bookmark and the Home button always bring you back to it.

---

## Updating later

- **On the Pi:** System → **Software update** → *Check for updates* →
  *Install update* (teacher PIN). Done in seconds.
- **Over SSH:** `cd ~/classpi && sudo bash update.sh`
- If a release note says it changes packages/services/config:
  `cd ~/classpi && git pull && sudo bash install.sh` (Enter through the
  prompts), then reboot. The Wi-Fi panel and the browser's lockdown are
  examples — Pis set up before they existed need this once.

---

## Setting up the Network Lab (2–3 Pis)

1. Install ClassPi on each Pi **with the same shared key**, connected to the
   same network.
2. Pick roles: one **sender**, one **receiver**, optionally one **middle**. On
   each Pi open **Network Lab**, press the **i** button (top-right) and choose
   that Pi's role under *This screen*.
3. On the sender, open the **i** settings → **Connect real Pis**. It scans the
   network and lists the other Pis by name — click **Use as receiver** on one
   and **Use as middle** on another. No IP addresses to look up or type.
4. Press *Test connections* to confirm, then send a message.

**Want to wire the Pis straight to each other** (no switch, and the cable-cutting
demo)? Add a **USB ethernet adapter** for the middle Pi and an **RJ45 coupler**,
then on each Pi use settings (**i**) → **Direct cable lab** to set it as Sender,
Middle or Receiver. See the README's *Direct cable lab* section for the lesson
sequence. Press **Back to normal** on each Pi afterwards to restore the school
network.

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
| Network Lab finds no other Pis | They must be switched on, finished booting, and on the *same* network — all ethernet or all the same Wi-Fi. Check each Pi's address on its **System** screen; if the first three parts differ (e.g. 192.168.**1**.x vs 192.168.**4**.x) they are on separate networks. |
| Receiver stays on *Waiting for a message...* after Send | The sender ran a **Simulation** (see the chip in its top-right corner): its Receiver box was empty, so nothing left the Pi. Open **i** → *Connect real Pis*, pick or type the receiver's address (`10.0.0.3` in the direct cable lab), then **Test connections** and send again. |
| No internet / updates after a Network Lab lesson | A Pi was left in **Direct cable lab** mode. Open Network Lab → **i** → *Direct cable lab* → **Back to normal**. |
| "Middle" button greyed out in Direct cable lab | That Pi has only one wired port. The middle Pi needs a USB ethernet adapter so it can bridge two cables. |
| Wi-Fi panel says the Pi was "set up before Wi-Fi settings existed" | `cd ~/classpi && git pull && sudo bash install.sh` once (Enter through the prompts). |
| Wi-Fi shows as *blocked* | No country has been set yet. System → **Wi-Fi** → **Turn Wi-Fi on** (teacher PIN). |
| Browser tile says it could not open | Chromium must be installed and the kiosk running; `journalctl -u classpi -e` shows the reason. |
| Want the Pi back to normal | `cd ~/classpi && sudo bash uninstall.sh`, then reboot. |

Any other issue: `Ctrl+Alt+F2` always gets you a terminal, and
`journalctl -u classpi -e`, `journalctl -u classpi-net -e` and
`journalctl -u classpi-kiosk -e` show what each part is doing.
