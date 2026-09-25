# ClassPi OS

A custom, SKM Software-branded Raspberry Pi setup for the Computing Science
classroom. Flash a stock Raspberry Pi OS Lite image, run one script, and the
Pi boots straight into a Linux-desktop-style launcher — wallpaper, a top panel
with the clock, and the teaching tools organised into a categorised SKM menu
(Programming, Networking, Revision...) — and nothing else. No distractions.

Built for a **Pi 5** with an **HDMI monitor + keyboard**, but it runs on a Pi 4
too.

---

## What's on it

| App | What it does |
|-----|--------------|
| **Python Lab** | A real code editor + runner. Auto-indent, line numbers, save/open pupil work, worked examples for every SQA standard algorithm. Runs code safely in a sandbox with a 5-second timeout and a memory cap. |
| **Binary Trainer** | Binary ↔ denary, plus two's complement (Higher). Click bits or use the keyboard; instant marking, working shown, score and streak. |
| **Algorithm Visualiser** | Step or animate through the standard algorithms (linear search, count occurrences, find max/min, running total) with the code line highlighted and variables tracked live. |
| **Network Lab** | Send a message between Pis, optionally through a "man in the middle", and toggle encryption to show why it matters. See below. |
| **Revision Quiz** | Multiple-choice questions by topic across N5 and Higher, with best-score tracking. Editable question bank. |
| **Timer & Picker** | Lesson countdown with presets and an end-of-time sound, plus a random name picker. |
| **System** | Live Pi health (temp, memory, disk, load, IP), one-click updates from GitHub, and PIN-protected restart / shutdown / exit-to-console. |

Everything works with **arrow keys + Enter** and number-key shortcuts, and
**Esc** always returns to the home screen.

---

## Installing it

> **New to this?** [INSTALL.md](INSTALL.md) is the full step-by-step guide —
> every click and command, plus troubleshooting. The short version follows.

**1. Flash the base image.** Use Raspberry Pi Imager to write **Raspberry Pi OS
Lite (64-bit)** to your SD card / SSD. In the Imager settings, set your Wi-Fi
(if not using ethernet) and enable SSH — that's the easiest way to run the
installer.

**2. Copy ClassPi onto the Pi** — *after it boots*, not by dropping files on the
card. Raspberry Pi OS uses a Linux (ext4) main partition that Windows/macOS
can't read, so the card won't show up normally (don't let it "format" the card).
Three easy ways:

- **From GitHub (recommended — easiest to update later):** boot the Pi, log in,
  then:
  ```bash
  sudo apt install -y git
  git clone https://github.com/SKM-Software/classpi.git
  cd classpi
  ```
- **Over SSH:** in the Imager settings (gear icon) set a hostname, enable SSH
  and set a username/password (and Wi-Fi if not on ethernet) before flashing.
  Boot the Pi, then from your computer:
  ```bash
  scp -r classpi <user>@<hostname>.local:~/
  ssh <user>@<hostname>.local
  ```
- **USB stick:** copy the `classpi` folder to a USB stick, boot the Pi, plug it
  in, then `sudo mount /dev/sda1 /mnt && cp -r /mnt/classpi ~/ && sudo umount /mnt`
  (use `lsblk` to confirm the stick's name).

**3. Run the installer** on the Pi:

```bash
cd classpi
sudo bash install.sh
```

It will ask for a device name, your department name, a teacher PIN, and a shared
key for the Network Lab (all have sensible defaults — just press Enter). Then:

```bash
sudo reboot
```

The Pi now boots to the ClassPi launcher automatically. That's it.

> Prefer no prompts (e.g. imaging lots of Pis)? Set them up front:
> `sudo CLASSPI_NAME="Lab Pi 1" CLASSPI_PIN=4821 bash install.sh`

---

## Updating a Pi after pushing changes

**Easiest: on the Pi itself.** Open **System → Software update**, press
*Check for updates*, then *Install update* (teacher PIN). The Pi pulls the
latest code from GitHub, applies it and the screen reloads — no SSH needed.
(This needs the Pi to have been set up from the GitHub clone.)

**Or over SSH**, from the repo folder on the Pi:

```bash
cd ~/classpi
sudo bash update.sh
```

It pulls the latest code, copies the app into place and restarts the ClassPi
services — the screen reloads in a few seconds. If an update changes packages,
services or configuration, re-run the full installer instead
(`sudo bash install.sh`) — it keeps the settings you chose the first time, so
you can just press Enter through the prompts. Re-running the installer is also
safe any time you're unsure which one an update needs.

---

## The Network Lab (1, 2 or 3 Pis)

This tool shows pupils how a message travels across a network, how a
**man-in-the-middle** can read it, and how **encryption** stops them.

Each Pi runs the same software. On each Pi you open **Network Lab** and choose
what that screen is, using the buttons at the top:

- **Sender / control** — where you type the message and press Send. This is the
  only screen with the animated diagram (there's a *Show animation* switch to
  hide it).
- **Middle (spy) screen** — quietly shows every message routed through that Pi.
  Readable when encryption is off; scrambled ciphertext when it's on.
- **Receiver screen** — shows the message that arrives (decrypted, because it
  holds the shared key).

### Ways to run it

- **One Pi (no wiring):** leave the address boxes empty and just press Send. It
  runs in **Simulation** mode — the whole journey animates on the one screen.
  Great for the projector.
- **Two Pis (sender + receiver, no middle):** leave *Put a Pi in the middle*
  **off**. On the sender, open *Connect real Pis* and enter the receiver's
  address. The message goes straight across.
- **Three Pis (with the spy in the middle):** turn *Put a Pi in the middle*
  **on** and enter both the receiver's and the relay's addresses. The message is
  routed sender → middle → receiver.

Addresses can be an IP (e.g. `192.168.1.42`) or a hostname (e.g.
`lab-pi-2.local`). Use **Test connections** to check the Pis can see each other.

### Choosing a cipher

The sender has an **Encryption** chooser so you can walk up the history of
cryptography:

- **None** — plaintext. The middle reads it outright.
- **Caesar shift** — pick a shift (1–25). Classical, easily broken.
- **Vigenère** — enter a keyword. Classical, stronger than Caesar but still
  breakable.
- **Pigpen** — letters become symbols (there's a *Show key* button for the key
  card). No secret key at all — pure obscurity.
- **Modern (AES)** — real symmetric encryption using the shared key set at
  install, which never travels with the message.

On the **middle screen**, plaintext shows in full, and classical ciphers get a
**"Crack it"** button that reveals the message (brute-forcing Caesar, reading
pigpen off the key card) — showing why they're weak. For modern encryption the
same button explains it can't be broken without the secret key.

### The teaching beat

1. Send with **None** — the middle reads it. "Anyone in the middle can see this."
2. Try **Caesar / Vigenère / Pigpen** — looks scrambled, but press *Crack it* on
   the middle screen and it falls apart. Classical ciphers only buy obscurity.
3. Switch to **Modern (AES)** — the middle is left with gibberish and *Crack it*
   gets nowhere, while the receiver still reads it perfectly.

> The key point for pupils (Kerckhoffs's principle): the algorithm can be public
> — what keeps a message safe is the secrecy of the **key**.

> **A note on honesty:** the middle Pi here is a relay you deliberately route
> through, so the demo is safe to run on your own kit. Real man-in-the-middle
> attacks (e.g. ARP spoofing) force traffic through an attacker without consent
> — worth naming for pupils, but not something to do on a live network. The app
> encrypts with AES (via Python's `cryptography`/Fernet); the shared key comes
> from your config.

---

## Changing things

- **Settings** live in `/etc/classpi/config.json` (device name, teacher PIN,
  shared key, timeout). Edit, then `sudo systemctl restart classpi`.
- **Quiz questions:** edit `app/data/quiz.json`, or drop a `ClassPi-Quiz.json`
  file in the pupil work folder to override without touching the install.
- **Pupil work** is saved in `~/ClassPi-Work` on the Pi.
- **Boot splash:** replace `branding/splash.png` (or re-run
  `python3 branding/make_splash.py` after editing it) and re-run the installer.

## Handy commands

```bash
sudo systemctl status classpi          # app server
sudo systemctl status classpi-net      # network lab node
sudo systemctl restart classpi-kiosk   # relaunch the full-screen browser
journalctl -u classpi -e               # server logs
sudo bash update.sh                    # pull latest from GitHub and apply
sudo bash uninstall.sh                 # remove ClassPi, restore normal boot
```

## What's in this folder

```
classpi/
├── install.sh              one-shot setup script
├── update.sh               pull latest from git and apply
├── uninstall.sh            removal / restore
├── README.md               this file
├── INSTALL.md              step-by-step install guide
├── branding/
│   ├── make_splash.py      regenerates the boot splash
│   └── splash.png          boot splash image
└── app/
    ├── server.py           local app server (launcher + apps + APIs)
    ├── netnode.py          Network Lab node (runs on every Pi)
    ├── requirements.txt
    ├── config.example.json
    ├── data/quiz.json      question bank
    └── static/             the launcher and the seven apps
```

## How it works (for the curious)

- A small **Flask** server (`server.py`) serves the launcher and apps on
  `127.0.0.1:8080` and provides the APIs (run code, save files, quiz, system,
  network control). **cage** (a tiny Wayland kiosk) launches **Chromium**
  full-screen pointing at it — no desktop environment needed.
- Pupil Python runs in an isolated subprocess (`python -I`) with CPU, memory and
  file-size limits and a timeout, so a runaway loop can't take the Pi down.
- The **Network Lab node** (`netnode.py`) listens on `0.0.0.0:8090` so the other
  Pis can reach it; the sender's control panel orchestrates the hops server-side
  (no browser cross-origin issues).
- Three **systemd** services (`classpi`, `classpi-net`, `classpi-kiosk`) keep it
  all running and restart on boot.
