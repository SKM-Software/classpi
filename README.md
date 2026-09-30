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
| **Network Lab** | Send a message between Pis, optionally through a "man in the middle", and toggle encryption to show why it matters. Skin the sender and receiver as real apps (chat, email, a login screen, a card payment) while the interceptor's screen stays raw. See below. |
| **Revision Quiz** | Multiple-choice questions by topic across N5 and Higher, with best-score tracking. Editable question bank. |
| **Timer & Picker** | Lesson countdown with presets and an end-of-time sound, plus a random name picker. |
| **System** | Live Pi health (temp, memory, disk, load, IP), Wi-Fi setup, one-click updates from GitHub, and PIN-protected restart / shutdown / exit-to-console. |
| **Web Browser** | A real Chromium window — address bar, tabs, back button — opened on top of ClassPi. Locked down for a classroom (no downloads, extensions, dev tools or sign-in; safe search forced) with a **Back to ClassPi** button, a ClassPi bookmark and a Home button that lead back. |

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

## The web browser

**Web Browser** (key **8**) opens a normal Chromium window — address bar, tabs,
back button — on top of ClassPi. The kiosk itself has no address bar, so this
is a second, separate browser with its own profile. Its start page has a
search box, a row of quick links and a **Back to ClassPi** button that closes
it and lands back on the desktop. Chromium's **Home** button and the
**ClassPi** bookmark on the bookmark bar always return to that start page
(Ctrl+Shift+W closes the window too).

It is locked down for pupils by Chromium's managed policies, which the
installer writes: no downloads, extensions, developer tools, incognito or
Google sign-in; safe search forced on Google and YouTube; `file://` and the
settings pages blocked. Searches use DuckDuckGo with strict safe search.
Chromium's own *SafeSites* adult-content filter is deliberately not turned on:
it checks every page with Google, the ClassPi screens included, and on a
network that is not fully online that check stalls the whole Pi. Content
filtering is left to the school network's filter.

In `/etc/classpi/config.json` you can switch the tile off
(`"browser_enabled": false`), change the search engine (`"browser_search"`,
e.g. `"https://www.google.com/search?q="`) or replace the quick links
(`"browser_links": [{"name": "...", "url": "..."}, ...]`). Then
`sudo systemctl restart classpi`.

> Pis set up before this existed need `sudo bash install.sh` run again once —
> that writes the lockdown policies. Without them the browser still opens,
> just without the classroom restrictions or the ClassPi bookmark.

## Connecting to Wi-Fi

**System → Wi-Fi** shows what the Pi is connected to, scans for networks and
joins one with the teacher PIN. Networks that need a username as well as a
password (school / enterprise logins) are detected and ask for both; **Other
network…** handles hidden networks. **Forget this network** drops a saved one.

**Public Wi-Fi with a sign-in page** (cafes, hotels, holiday parks, Wifinity
and the like) lets the Pi join but gives no internet until someone accepts the
terms on a web page. ClassPi checks for this after connecting and opens that
page in the Web Browser; sign in, close the browser, and you are online. Until
then the status bar shows **wi-fi sign-in needed**, and **System → Wi-Fi** has
a **Sign in to this Wi-Fi** button. This works even with the Browser tile
switched off, but only for the sign-in page the Pi found itself.

A freshly imaged Pi keeps its Wi-Fi radio blocked until a country has been
set; the panel then offers **Turn Wi-Fi on**, which applies `"wifi_country"`
from the config (default `GB`) and enables the radio.

Wi-Fi and the Network Lab's direct-cable mode go together: a Pi wired to
another in lab mode keeps its internet through Wi-Fi.

> This too needs `sudo bash install.sh` run once on Pis set up before it
> existed — it installs the root-side helper the panel uses to connect.

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

### Wiring them together (no IP addresses to look up)

On the sender, open the settings (**i**, top-right) → **Connect real Pis**. It
scans the network and lists every ClassPi it finds by name:

```
This Pi is lab-pi-1 at 192.168.1.41

  lab-pi-2   192.168.1.42    [Use as receiver] [Use as middle]
  lab-pi-3   192.168.1.43    [Use as receiver] [Use as middle]
```

Click **Use as receiver** on one and (if you want a spy in the middle) **Use as
middle** on another — that also flips the *Put a Pi in the middle* switch for
you. Nothing to type.

The panel also shows **this Pi's own name and address** at the top, which is
handy when you're standing at one of the others. Press **Find Pis on the
network** again if you switch a Pi on later.

If you'd rather type it, the boxes still accept an IP (`192.168.1.42`) or a
hostname (`lab-pi-2.local`), and **Test connections** checks they can see each
other. Each Pi's address is also on its **System** screen.

> Nothing found? Check the other Pis are switched on, finished booting, and on
> the same network (all on ethernet, or all on the same Wi-Fi — a Pi on the
> guest network won't be seen).

### Direct cable lab — cutting the wire in front of the class

The most convincing version of this lesson is physical: wire two Pis together,
send a message, then **cut the cable and insert the middle Pi** in front of the
pupils.

**You need:** a **USB ethernet adapter** for the middle Pi (~£10, it needs two
ports), an **RJ45 inline coupler** (~£3), and two ethernet cables. No switch or
router.

**Set it up** in the settings (**i**) → **Direct cable lab**, on each Pi. Press
*Sender*, *Middle* or *Receiver*, enter the teacher PIN, done — each Pi takes a
fixed address (`10.0.0.1`, `.2`, `.3`) so they can talk with no router handing
out addresses. The middle Pi bridges its two ports so traffic really does pass
through it. **Back to normal** returns any Pi to the school network.

Setting a Pi as *Sender* also fills in the **Receiver** (`10.0.0.3`) and
**Middle** (`10.0.0.2`) boxes under *Connect real Pis*, so **Send** goes down
the cable rather than running the on-screen simulation. The chip in the top
right says **Live network** when a message really leaves the Pi and
**Simulation** when it does not.

**The lesson:**

1. Sender → cable → **coupler** → cable → receiver. Leave *Put a Pi in the
   middle* off. Send. It arrives. *"These two are talking directly."*
2. Pull the coupler apart and plug both cables into the middle Pi. Turn *Put a
   Pi in the middle* on and pick it. Send again — it still arrives, and the
   middle screen now shows the message.
3. Plaintext: the middle reads it. Switch to **AES**: gibberish for the middle,
   perfect for the receiver.
4. **Switch the middle Pi off.** Nothing arrives at all — proof the traffic
   genuinely runs through that machine, not just on screen.

> Lab mode takes a Pi off the school network, so there's no internet or software
> updates until you press **Back to normal**. Put the Pis back on the normal
> network before you update them.

> Being honest with pupils: even bridged, the middle Pi is *shown* the message
> because the sender routes to it. Its physical position is real; the
> interception is still consensual. A real attacker wouldn't ask — they'd force
> the traffic through themselves (e.g. ARP spoofing), which is exactly why you
> don't do that on a school network.

> Update all the Pis in a set together. A Pi still running an older version
> will pass messages fine, but drops the app skin, so the receiver falls back
> to the Classic look.

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

### Making it look like a real app

Pick an **App** and the whole screen becomes that app — a working one. You type
in its own message box and press its own send button, exactly as pupils would
at home. A small **i** button in the top-right corner opens the settings
(encryption, app, this screen's role, connections, teaching notes) so nothing
else clutters the screen.

| App | What you fill in |
|-----|------------------|
| **Classic (no app)** | the control view: wire diagram, message box and trace |
| **Chat (WhatsApp-style)**, **Chat (Messenger-style)**, **Text messages (iMessage-style)** | type and send on a phone, each styled like the real app; messages stack up as a bubble thread |
| **Email client (Outlook-style)** | opens on a new message, inside a full mail client — ribbon, folder pane and inbox; the receiver reads it in the reading pane |
| **Website login page** | username + password on a full school-portal site, then Sign in |
| **Online shop checkout** | card number + expiry + security code in a shop's checkout, then Place your order |

The chosen app travels with the message, so the receiver matches the sender
automatically (there's an override on the receiver screen if you want it).

The **middle screen is never skinned** — that's the point. Sender and receiver
see a friendly app; the interceptor sees the raw bytes that actually crossed
the wire.

> Try the **shop checkout** with a **Caesar shift**. Classical ciphers only move
> the letters A–Z, so the card number, expiry and security code travel
> completely unscrambled — the sharpest demonstration in the whole app of why
> classical ciphers are useless for real data. (The card details are fake;
> pupils should never type a real card number.)

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
  shared key, timeout, browser search engine and quick links, Wi-Fi country).
  Edit, then `sudo systemctl restart classpi`. Re-running the installer keeps
  any keys you add.
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
    └── static/             the launcher, the apps and the browser start page
```

## How it works (for the curious)

- A small **Flask** server (`server.py`) serves the launcher and apps on
  `127.0.0.1:8080` and provides the APIs (run code, save files, quiz, system,
  network control). **cage** (a tiny Wayland kiosk) launches **Chromium**
  full-screen pointing at it — no desktop environment needed.
- **Web Browser** is a second Chromium (own profile, normal UI) that the server
  starts on cage's Wayland socket. Cage shows every window maximised with the
  newest on top, so the launcher simply waits underneath until the browser
  closes. Managed policies in `/etc/chromium/policies/managed/` lock it down.
- **Wi-Fi** goes through NetworkManager: the server reads status and scans with
  `nmcli`; connect / forget / radio-on run through a small root helper
  (`classpi-wifi`) allowed in sudoers, with the password passed on stdin.
- Pupil Python runs in an isolated subprocess (`python -I`) with CPU, memory and
  file-size limits and a timeout, so a runaway loop can't take the Pi down.
- The **Network Lab node** (`netnode.py`) listens on `0.0.0.0:8090` so the other
  Pis can reach it; the sender's control panel orchestrates the hops server-side
  (no browser cross-origin issues).
- Three **systemd** services (`classpi`, `classpi-net`, `classpi-kiosk`) keep it
  all running and restart on boot.
