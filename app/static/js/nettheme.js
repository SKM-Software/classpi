// ClassPi Network Lab - app themes.
//
// Each theme is a working, full-screen pastiche of an app pupils actually use:
// you type in the app's own message box and press its own send button. The
// sender and receiver screens both dress up; the middle (spy) screen never
// does - the whole point is that the friendly interface is skin deep and the
// network only ever sees bytes.
//
// CSS-drawn only. No real logos, brand assets or trademarks.
(function () {
  const SEP = "\u001f";   // unit separator: joins multi-field messages
  const SEP_SHOWN = "␟";  // the visible glyph used in raw (spy) views

  const esc = (s) => String(s == null ? "" : s)
    .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const hhmm = (at) => new Date((at || Date.now() / 1000) * 1000)
    .toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // ------------------------------------------------------------ shell pieces
  function shell(cls, bar, body, compose) {
    return `<div class="nt-app ${cls}">${bar}<div class="nt-app-body">${body}</div>${compose || ""}</div>`;
  }
  // Chat apps live on a phone, so draw one: a chat stretched across a 1080p
  // monitor stops looking like the thing pupils actually use.
  const STATUS_ICONS =
    '<svg viewBox="0 0 18 12" width="17" height="11" fill="currentColor" aria-hidden="true">' +
    '<rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/>' +
    '<rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
    '<svg viewBox="0 0 16 12" width="15" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M1 4.2a10 10 0 0 1 14 0"/><path d="M3.6 6.9a6.4 6.4 0 0 1 8.8 0"/><circle cx="8" cy="9.8" r="1.1" fill="currentColor" stroke="none"/></svg>' +
    '<svg viewBox="0 0 26 12" width="24" height="11" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
    '<rect x="1" y="1" width="21" height="10" rx="3"/><rect x="2.8" y="2.8" width="15" height="6.4" rx="1.6" fill="currentColor" stroke="none"/>' +
    '<path d="M24 4.4v3.2" stroke-linecap="round"/></svg>';

  function phoneShell(cls, barHtml, bodyHtml, composeHtml) {
    return `<div class="nt-stage ${cls}">
      <div class="nt-phone"><div class="nt-screen">
        <div class="nt-sbar"><span class="nt-clock">${esc(hhmm())}</span>
          <span class="nt-sicons">${STATUS_ICONS}</span></div>
        <div class="nt-island"></div>
        ${barHtml}
        <div class="nt-app-body">${bodyHtml}</div>
        ${composeHtml || ""}
        <div class="nt-home"></div>
      </div></div>
    </div>`;
  }
  function bar(title, sub) {
    return `<div class="nt-bar"><span class="nt-avatar"></span>
      <div class="nt-bar-t"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div></div>`;
  }
  function threadBody(msgs, inCls) {
    const rows = msgs.slice(0, 30).reverse().map((m) => {
      const text = m.plain != null ? m.plain : m.payload;
      return bubbleHtml(inCls, text, false, hhmm(m.at));
    }).join("");
    return `<div class="nt-thread" data-thread>${rows}</div>` +
      (msgs.length ? "" : `<div class="nt-empty" data-empty>No messages yet</div>`);
  }
  function bubbleHtml(cls, text, out, time) {
    return `<div class="nt-row ${out ? "nt-r" : "nt-l"}"><div class="nt-bubble ${cls}">` +
      `${esc(text)}<span class="nt-time">${esc(time || "")}${out ? ' <span class="nt-tick">&#10003;&#10003;</span>' : ""}</span>` +
      `</div></div>`;
  }
  function chatCompose(live) {
    return `<div class="nt-compose">
      <input type="text" class="nt-in" data-field="message" placeholder="Message"
             autocomplete="off" ${live ? "" : "disabled"}>
      <button type="button" class="nt-send" ${live ? "data-send" : "disabled"} title="Send">&#10148;</button>
    </div>`;
  }
  // ------------------------------------------------------------ mail chrome
  // A desktop mail client: header, ribbon, folder pane, message list and a
  // reading/compose pane. The furniture is decorative - only the compose
  // fields and Send actually do anything.
  const ICO = {
    menu: "M3 6h18M3 12h18M3 18h18",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
    gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-2-4-2 1-2-1-1-2h-4l-1 2-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z",
    help: "M12 17v.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4",
    newmail: "M4 20h16M6 16l10-10 3 3-10 10H6v-3z",
    trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13",
    archive: "M3 7h18v3H3zM5 10v10h14V10M10 14h4",
    reply: "M9 7L4 12l5 5M4 12h9a7 7 0 0 1 7 7",
    replyall: "M8 7l-5 5 5 5M13 7l-5 5 5 5M8 12h8a5 5 0 0 1 5 5",
    forward: "M15 7l5 5-5 5M20 12h-9a7 7 0 0 0-7 7",
    flag: "M5 21V4h13l-2.5 4L18 12H5",
    inbox: "M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z",
    send: "M3 11l18-8-8 18-2-7-8-3z",
    draft: "M4 20h16M6 16l10-10 3 3-10 10H6v-3z",
    junk: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM6 6l12 12",
    chev: "M9 6l6 6-6 6",
  };
  const ic = (n, sz) => `<svg viewBox="0 0 24 24" width="${sz || 18}" height="${sz || 18}" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"><path d="${ICO[n]}"/></svg>`;

  // Plausible classroom email so the inbox never looks empty.
  const CANNED = [
    { from: "IT Services", subject: "Password expiry reminder", peek: "Your network password will expire in 5 days. To change it...", when: "09:14" },
    { from: "School Office", subject: "Parents' evening arrangements", peek: "Bookings open on Monday at 9am through the parent portal...", when: "Mon 08:32" },
    { from: "Library", subject: "Overdue: Programming in Python", peek: "Our records show the following item is now overdue...", when: "Mon 16:05" },
    { from: "N5 Computing", subject: "Assignment feedback", peek: "I have marked the assignments - see my comments in the...", when: "Fri 14:48" },
    { from: "S. Kennedy", subject: "Higher prelim timetable", peek: "Please find the prelim timetable attached. Note the change...", when: "Fri 11:20" },
  ];

  function mailHeader() {
    return `<div class="nt-ol-head">
      <button class="nt-ol-waffle">${ic("menu", 20)}</button>
      <span class="nt-ol-brand"><span class="nt-ol-mark"></span>Mail</span>
      <div class="nt-ol-search">${ic("search", 16)}<span>Search</span></div>
      <div class="nt-ol-hicons">${ic("gear", 18)}${ic("help", 18)}<span class="nt-ol-me">AM</span></div>
    </div>`;
  }
  function mailRibbon() {
    const btn = (icon, label) => `<span class="nt-ol-rb">${ic(icon)}${label}</span>`;
    return `<div class="nt-ol-tabs"><b>Home</b><span>View</span><span>Help</span></div>
      <div class="nt-ol-ribbon">
        ${btn("newmail", "New mail")}<i></i>
        ${btn("trash", "Delete")}${btn("archive", "Archive")}${btn("junk", "Report")}<i></i>
        ${btn("reply", "Reply")}${btn("replyall", "Reply all")}${btn("forward", "Forward")}<i></i>
        ${btn("flag", "Flag")}
      </div>`;
  }
  function mailNav(unread) {
    const f = (icon, name, count, on) =>
      `<div class="nt-ol-f ${on ? "on" : ""}">${ic(icon, 16)}<span>${name}</span>${count ? `<b>${count}</b>` : ""}</div>`;
    return `<div class="nt-ol-nav">
      <button class="nt-ol-new">${ic("newmail", 16)} New mail</button>
      <div class="nt-ol-sec">Favourites</div>
      ${f("inbox", "Inbox", unread, true)}
      ${f("send", "Sent Items", 0)}
      ${f("draft", "Drafts", 1)}
      ${f("trash", "Deleted Items", 0)}
      ${f("archive", "Archive", 0)}
      ${f("junk", "Junk Email", 0)}
      <div class="nt-ol-sec">Folders</div>
      ${f("inbox", "Computing S5", 0)}
      ${f("inbox", "Staff notices", 0)}
    </div>`;
  }
  function mailList(rows) {
    return `<div class="nt-ol-listhead"><b>Inbox</b><span>Filter</span></div>
      <div class="nt-ol-rows">${rows}</div>`;
  }
  function mailRow(from, subject, peek, when, unread, on) {
    return `<div class="nt-ol-row ${on ? "on" : ""} ${unread ? "unread" : ""}">
      <span class="nt-ol-dot"></span>
      <div class="nt-ol-rtext">
        <div class="nt-ol-rtop"><b>${esc(from)}</b><i>${esc(when)}</i></div>
        <div class="nt-ol-rsub">${esc(subject) || "(no subject)"}</div>
        <div class="nt-ol-rpeek">${esc(peek)}</div>
      </div></div>`;
  }
  function mailShell(rows, pane, unread) {
    return `<div class="nt-app nt-mail">
      ${mailHeader()}${mailRibbon()}
      <div class="nt-ol-body">
        ${mailNav(unread)}
        <div class="nt-ol-list">${mailList(rows)}</div>
        <div class="nt-ol-pane">${pane}</div>
      </div></div>`;
  }

  // A chat theme is the same shell three times over - only the palette differs.
  function chatTheme(label, cls, title, inCls, outCls) {
    return {
      label, cls, fields: null, thread: true, outCls, phone: true,
      renderSender() { return phoneShell(cls, bar(title, "online"), threadBody([], inCls), chatCompose(true)); },
      renderReceiver(msgs) { return phoneShell(cls, bar(title, "online"), threadBody(msgs, inCls), chatCompose(false)); },
      noteSent(root, values) {
        const th = root.querySelector("[data-thread]");
        const empty = root.querySelector("[data-empty]");
        if (empty) empty.remove();
        th.insertAdjacentHTML("beforeend", bubbleHtml(outCls, values[0], true, hhmm()));
        th.scrollTop = th.scrollHeight;
      },
    };
  }

  // ------------------------------------------------------------ definitions
  const defs = {
    classic: {
      label: "Classic (no app)",
      fields: null,
      renderReceiver(msgs) {
        const m = msgs[0];
        const text = m.plain != null ? m.plain : m.payload;
        const label = (m.scheme || "none") === "none"
          ? "received (was plaintext)" : "decoded with the shared setup";
        return `<div style="text-align:center"><div class="chip">${esc(label)}</div>
          <div style="font-size:6vmin;font-weight:800;color:#cffbe9;margin-top:14px;word-break:break-word">${esc(text)}</div></div>`;
      },
    },

    whatsapp:  chatTheme("Chat (WhatsApp-style)", "nt-wa", "Class chat", "nt-wa-in", "nt-wa-out"),
    messenger: chatTheme("Chat (Messenger-style)", "nt-msgr", "Messages", "nt-msgr-in", "nt-msgr-out"),
    sms:       chatTheme("Text messages (SMS-style)", "nt-sms", "Messages", "nt-sms-in", "nt-sms-out"),

    email: {
      label: "Email client (Outlook-style)",
      cls: "nt-mail",
      fields: [
        { id: "subject", label: "Subject", placeholder: "Add a subject" },
        { id: "body", label: "Message", placeholder: "Type your message", area: true },
      ],
      // Opens on the new-message screen, with the rest of the client around it.
      renderSender() {
        const rows = CANNED.map((c, i) => mailRow(c.from, c.subject, c.peek, c.when, i < 2, false)).join("");
        return mailShell(rows, `
          <div class="nt-ol-compose">
            <div class="nt-ol-ctitle">New message</div>
            <div class="nt-ol-crow"><span>To</span><div><span class="nt-ol-chip"><i></i>the other Pi</span></div></div>
            <div class="nt-ol-crow"><span>Cc</span><div></div></div>
            <div class="nt-ol-crow nt-ol-csub">
              <input type="text" data-field="subject" placeholder="Add a subject" autocomplete="off"></div>
            <div class="nt-ol-format">
              <b>B</b><i>I</i><u>U</u><span class="nt-ol-sep"></span><span>A</span><span>&#9679;</span><span>&#8801;</span>
            </div>
            <textarea data-field="body" placeholder="Type your message"></textarea>
            <div class="nt-ol-cactions">
              <button type="button" class="nt-ol-send" data-send>${ic("send", 16)} Send</button>
              <button type="button" class="nt-ol-discard">${ic("trash", 16)} Discard</button>
              <span class="nt-status" data-status></span>
            </div>
          </div>`, 2);
      },
      renderReceiver(msgs) {
        const m = msgs[0];
        const [subject, body] = splitFor("email", m.plain != null ? m.plain : m.payload);
        // Arrived mail sits at the top of an otherwise ordinary-looking inbox.
        const got = msgs.slice(0, 6).map((x, i) => {
          const [s, b] = splitFor("email", x.plain != null ? x.plain : x.payload);
          return mailRow(x.from || "?", s, b, hhmm(x.at), i === 0, i === 0);
        }).join("");
        const rows = got + CANNED.map((c) => mailRow(c.from, c.subject, c.peek, c.when, false, false)).join("");
        return mailShell(rows, `
          <div class="nt-ol-read">
            <h1>${esc(subject) || "(no subject)"}</h1>
            <div class="nt-ol-rhead">
              <span class="nt-ol-av">${esc((m.from || "?").slice(0, 2).toUpperCase())}</span>
              <div class="nt-ol-rwho"><b>${esc(m.from || "?")}</b><span>To: me</span></div>
              <i>${esc(new Date((m.at || 0) * 1000).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" }))}</i>
            </div>
            <div class="nt-ol-rbody">${esc(body) || "(empty message)"}</div>
            <div class="nt-ol-ractions">
              <button type="button">${ic("reply", 15)} Reply</button>
              <button type="button">${ic("replyall", 15)} Reply all</button>
              <button type="button">${ic("forward", 15)} Forward</button>
            </div>
          </div>`, msgs.length);
      },
      noteSent(root) { status(root, "Message sent"); },
    },

    login: {
      label: "Login screen",
      cls: "nt-login",
      fields: [
        { id: "username", label: "Username", placeholder: "Username" },
        { id: "password", label: "Password", placeholder: "Password", type: "password" },
      ],
      renderSender() {
        return shell("nt-login", "", `
          <div class="nt-card-box">
            <div class="nt-logo"></div>
            <h2>Sign in</h2>
            <p class="nt-sub">Use your school account</p>
            <label>Username<input type="text" data-field="username" placeholder="Username" autocomplete="off"></label>
            <label>Password<input type="password" data-field="password" placeholder="Password" autocomplete="off"></label>
            <button type="button" class="nt-btn nt-block" data-send>Sign in</button>
            <div class="nt-status" data-status></div>
          </div>`);
      },
      renderReceiver(msgs) {
        const m = msgs[0];
        const [user, pass] = splitFor("login", m.plain != null ? m.plain : m.payload);
        return shell("nt-login", "", `
          <div class="nt-card-box nt-server">
            <div class="nt-logo"></div>
            <h2>Sign-in received</h2>
            <p class="nt-sub">The server checked these details and let the user in.</p>
            <div class="nt-kv"><span>Username</span><b>${esc(user)}</b></div>
            <div class="nt-kv"><span>Password</span><b class="nt-secret">${esc(pass)}</b></div>
            <div class="nt-ok">&#10003; Signed in</div>
          </div>`);
      },
      noteSent(root) { status(root, "Signing in..."); },
    },

    banking: {
      label: "Card payment",
      cls: "nt-bank",
      warn: "Demo data only - never type a real card number.",
      fields: [
        { id: "card", label: "Card number", placeholder: "4000 1234 5678 9010", max: 24 },
        { id: "expiry", label: "Expiry", placeholder: "09/28", max: 7 },
        { id: "cvv", label: "Security code", placeholder: "311", max: 4 },
      ],
      renderSender() {
        return shell("nt-bank", bar("Checkout", "Secure payment"), `
          <div class="nt-card-box">
            <div class="nt-total"><span>Total to pay</span><b>&pound;24.99</b></div>
            <label>Card number<input type="text" data-field="card" maxlength="24" placeholder="4000 1234 5678 9010" autocomplete="off"></label>
            <div class="nt-two">
              <label>Expiry<input type="text" data-field="expiry" maxlength="7" placeholder="09/28" autocomplete="off"></label>
              <label>Security code<input type="text" data-field="cvv" maxlength="4" placeholder="311" autocomplete="off"></label>
            </div>
            <button type="button" class="nt-btn nt-block nt-pay" data-send>Pay &pound;24.99</button>
            <div class="nt-status" data-status></div>
            <p class="nt-warn">Demo data only - never type a real card number.</p>
          </div>`);
      },
      renderReceiver(msgs) {
        const m = msgs[0];
        const [num, expiry, cvv] = splitFor("banking", m.plain != null ? m.plain : m.payload);
        return shell("nt-bank", bar("Checkout", "Payment received"), `
          <div class="nt-card-box">
            <div class="nt-plastic">
              <div class="nt-chip"></div>
              <div class="nt-num">${esc(num) || "&bull;&bull;&bull;&bull;"}</div>
              <div class="nt-crow"><span><small>EXPIRES</small>${esc(expiry) || "--/--"}</span>
                <span><small>SECURITY CODE</small>${esc(cvv) || "---"}</span></div>
            </div>
            <div class="nt-ok">&#10003; Payment of &pound;24.99 received</div>
          </div>`);
      },
      noteSent(root) { status(root, "Payment sent"); },
    },
  };

  function status(root, text) {
    const el = root.querySelector("[data-status]");
    if (el) { el.textContent = text; clearTimeout(el._t); el._t = setTimeout(() => (el.textContent = ""), 2600); }
  }

  // ------------------------------------------------------------ field coding
  function join(values) {
    return values.map((v) => String(v == null ? "" : v)).join(SEP);
  }
  // Split a decoded message back into a theme's fields. Never throws: extra
  // parts fold into the last field, and anything unexpected (including a failed
  // decryption) drops whole into the theme's main body slot.
  function splitFor(themeId, plain) {
    const def = defs[themeId] || defs.classic;
    const text = String(plain == null ? "" : plain);
    const n = def.fields ? def.fields.length : 1;
    if (n === 1) return [text];
    const parts = text.split(SEP);
    if (parts.length < n) {
      const out = new Array(n).fill("");
      out[themeId === "email" ? 1 : 0] = text;   // body slot
      return out;
    }
    if (parts.length > n) {
      return parts.slice(0, n - 1).concat(parts.slice(n - 1).join(" "));
    }
    return parts;
  }

  const showJoined = (s) => String(s == null ? "" : s).split(SEP).join(" · ");
  const showRaw = (s) => String(s == null ? "" : s).split(SEP).join(SEP_SHOWN);

  // ------------------------------------------------------------ mounting
  // Render the sender's app into `root` and wire its own send button / Enter
  // key to `onSend`. Re-rendering on every keystroke would drop focus, so the
  // shell is drawn once and messages are appended afterwards.
  function mountSender(root, themeId, onSend) {
    const def = get(themeId);
    root.innerHTML = def.renderSender ? def.renderSender() : "";
    root.querySelectorAll("[data-send]").forEach((b) => b.addEventListener("click", onSend));
    root.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && el.tagName !== "TEXTAREA") { e.preventDefault(); onSend(); }
      });
    });
    const first = root.querySelector("[data-field]");
    if (first) first.focus();
  }
  function readFields(root) {
    const els = [...root.querySelectorAll("[data-field]")];
    return els.length ? els.map((el) => el.value) : [""];
  }
  function clearFields(root, themeId) {
    const def = get(themeId);
    // Chat apps clear so you can fire off another line; forms keep their
    // contents so the class can resend the same details under a new cipher.
    if (!def.fields) root.querySelectorAll("[data-field]").forEach((el) => (el.value = ""));
  }
  function noteSent(root, themeId, values) {
    const def = get(themeId);
    if (def.noteSent) def.noteSent(root, values);
  }
  function get(id) { return defs[id] || defs.classic; }

  // ------------------------------------------------------------ styles
  const CSS = `
.nt-app { position: fixed; inset: 0; display: flex; flex-direction: column; z-index: 5;
  font-family: system-ui, "Segoe UI", sans-serif; color: #111; }
.nt-app-body { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
.nt-bar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; color: #fff; flex: 0 0 auto; }
.nt-bar-t { display: flex; flex-direction: column; line-height: 1.2; }
.nt-bar-t b { font-size: 18px; }
.nt-bar-t span { font-size: 13px; opacity: .8; }
.nt-avatar { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.3); flex: 0 0 34px; }

.nt-thread { flex: 1; min-height: 0; overflow: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 8px; }
.nt-empty { text-align: center; color: #98a0ad; padding: 30px; font-size: 17px; }
.nt-row { display: flex; width: 100%; max-width: 900px; margin: 0 auto; }
.nt-row.nt-l { justify-content: flex-start; }
.nt-row.nt-r { justify-content: flex-end; }
.nt-bubble { max-width: 72%; padding: 9px 13px; border-radius: 15px; font-size: 17px; line-height: 1.4;
  word-break: break-word; box-shadow: 0 1px 1px rgba(0,0,0,.12); }
.nt-time { display: block; font-size: 11px; opacity: .55; text-align: right; margin-top: 3px; }
.nt-compose { display: flex; gap: 10px; padding: 12px 16px; align-items: center; flex: 0 0 auto; }
.nt-compose > * { max-width: 900px; }
.nt-in { flex: 1; border: 0; border-radius: 999px; padding: 13px 18px; font-size: 17px;
  background: #fff; color: #111; outline: none; min-width: 0; }
.nt-in:disabled { opacity: .7; }
.nt-send { width: 48px; height: 48px; border-radius: 50%; border: 0; cursor: pointer;
  color: #fff; font-size: 19px; flex: 0 0 48px; }
.nt-send:disabled { opacity: .45; cursor: default; }

/* --- phone mockup used by the chat apps --- */
.nt-stage { position: fixed; inset: 0; z-index: 5; display: grid; place-items: center;
  background: radial-gradient(900px 600px at 20% 0%, #223052 0%, transparent 60%), #0e1320; }
.nt-phone { position: relative; height: min(860px, calc(100vh - 34px)); aspect-ratio: 390 / 844;
  background: #0a0c11; border-radius: 48px; padding: 11px;
  box-shadow: 0 0 0 2px #333846, 0 26px 70px rgba(0,0,0,.65); }
.nt-screen { height: 100%; border-radius: 38px; overflow: hidden; display: flex; flex-direction: column;
  position: relative; background: #fff; }
.nt-sbar { display: flex; align-items: center; justify-content: space-between;
  padding: 11px 26px 7px; font-size: 14px; font-weight: 700; flex: 0 0 auto; }
.nt-sicons { display: inline-flex; align-items: center; gap: 5px; }
.nt-island { position: absolute; top: 9px; left: 50%; transform: translateX(-50%);
  width: 34%; height: 26px; border-radius: 15px; background: #0a0c11; }
.nt-home { flex: 0 0 auto; height: 22px; display: grid; place-items: center; }
.nt-home::after { content: ""; width: 36%; height: 5px; border-radius: 3px; background: rgba(0,0,0,.35); }
/* the phone is narrow - tighten the chat furniture to suit */
.nt-phone .nt-thread { padding: 12px 10px; gap: 6px; }
.nt-phone .nt-bar { padding: 9px 16px; }
.nt-phone .nt-bar-t b { font-size: 16px; }
.nt-phone .nt-avatar { width: 30px; height: 30px; flex-basis: 30px; }
.nt-phone .nt-compose { padding: 8px 10px; gap: 8px; }
.nt-phone .nt-in { padding: 10px 14px; font-size: 16px; }
.nt-phone .nt-send { width: 40px; height: 40px; flex-basis: 40px; font-size: 16px; }
.nt-phone .nt-bubble { font-size: 16px; max-width: 80%; }

.nt-wa .nt-bar, .nt-wa .nt-sbar { background: #075e54; color: #fff; }
.nt-wa .nt-home { background: #f0f0f0; }
.nt-msgr .nt-bar, .nt-msgr .nt-sbar { background: #0084ff; color: #fff; }
.nt-msgr .nt-home { background: #f2f3f5; }
.nt-sms .nt-bar, .nt-sms .nt-sbar { background: #3b3b3d; color: #fff; }
.nt-sms .nt-home { background: #f6f6f6; }

.nt-wa .nt-app-body, .nt-wa .nt-thread { background: #ece5dd; }
.nt-wa .nt-compose { background: #f0f0f0; }
.nt-wa .nt-send { background: #25d366; }
.nt-wa-in { background: #fff; }
.nt-wa-out { background: #dcf8c6; }

.nt-msgr .nt-app-body, .nt-msgr .nt-thread { background: #fff; }
.nt-msgr .nt-compose { background: #f2f3f5; }
.nt-msgr .nt-in { background: #eceff1; }
.nt-msgr .nt-send { background: #0084ff; }
.nt-msgr-in { background: #eceff1; }
.nt-msgr-out { background: #0084ff; color: #fff; }

.nt-sms .nt-app-body, .nt-sms .nt-thread { background: #fff; }
.nt-sms .nt-compose { background: #f6f6f6; }
.nt-sms .nt-in { background: #eceff1; }
.nt-sms .nt-send { background: #1d8cf8; }
.nt-sms-in { background: #e9e9eb; }
.nt-sms-out { background: #1d8cf8; color: #fff; }

/* --- desktop mail client (Outlook-style layout) --- */
.nt-mail { background: #f3f3f3; color: #201f1e; font-size: 14px; }
.nt-ol-head { display: flex; align-items: center; gap: 14px; padding: 0 14px; height: 48px;
  background: #0f6cbd; color: #fff; flex: 0 0 auto; }
.nt-ol-waffle { background: none; border: 0; color: #fff; cursor: pointer; display: grid; place-items: center; padding: 6px; border-radius: 4px; }
.nt-ol-brand { display: flex; align-items: center; gap: 9px; font-size: 16px; font-weight: 600; }
.nt-ol-mark { width: 21px; height: 17px; border-radius: 3px; background: #fff; position: relative; }
.nt-ol-mark::after { content: ""; position: absolute; inset: 3px; border: 2px solid #0f6cbd; border-radius: 1px;
  clip-path: polygon(0 0, 100% 0, 50% 60%); }
.nt-ol-search { flex: 1; max-width: 520px; display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,.18); border-radius: 4px; padding: 6px 10px; color: #eaf2fb; }
.nt-ol-hicons { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.nt-ol-me { width: 30px; height: 30px; border-radius: 50%; background: #c8a1e0; color: #3a1d4e;
  display: grid; place-items: center; font-size: 12px; font-weight: 700; }
.nt-ol-tabs { display: flex; gap: 20px; padding: 7px 18px 0; background: #fff; font-size: 13px;
  color: #444; flex: 0 0 auto; }
.nt-ol-tabs b { color: #0f6cbd; border-bottom: 2px solid #0f6cbd; padding-bottom: 5px; }
.nt-ol-ribbon { display: flex; align-items: center; gap: 4px; padding: 5px 14px 7px; background: #fff;
  border-bottom: 1px solid #e1dfdd; flex: 0 0 auto; overflow: hidden; }
.nt-ol-rb { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 4px;
  font-size: 13px; white-space: nowrap; cursor: default; }
.nt-ol-rb:hover { background: #f0f0f0; }
.nt-ol-ribbon i { width: 1px; height: 20px; background: #e1dfdd; margin: 0 6px; flex: 0 0 1px; }
.nt-ol-body { flex: 1; min-height: 0; display: flex; }
.nt-ol-nav { width: 210px; flex: 0 0 210px; background: #f3f3f3; padding: 12px 8px; overflow: auto;
  border-right: 1px solid #e6e4e2; }
.nt-ol-new { display: flex; align-items: center; gap: 8px; width: 100%; background: #0f6cbd; color: #fff;
  border: 0; border-radius: 4px; padding: 9px 12px; font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: inherit; margin-bottom: 14px; }
.nt-ol-sec { font-size: 12px; color: #605e5c; padding: 10px 10px 5px; font-weight: 600; }
.nt-ol-f { display: flex; align-items: center; gap: 9px; padding: 7px 10px; border-radius: 4px; cursor: default; }
.nt-ol-f span { flex: 1; }
.nt-ol-f b { font-size: 12px; color: #0f6cbd; }
.nt-ol-f:hover { background: #ebeaea; }
.nt-ol-f.on { background: #e1eefa; font-weight: 600; }
.nt-ol-list { width: 340px; flex: 0 0 340px; background: #fff; border-right: 1px solid #e6e4e2;
  display: flex; flex-direction: column; min-height: 0; }
.nt-ol-listhead { display: flex; justify-content: space-between; align-items: center;
  padding: 11px 14px; border-bottom: 1px solid #edebe9; font-size: 13px; }
.nt-ol-listhead b { font-size: 15px; }
.nt-ol-listhead span { color: #0f6cbd; }
.nt-ol-rows { flex: 1; overflow: auto; min-height: 0; }
.nt-ol-row { display: flex; gap: 8px; padding: 9px 12px 9px 8px; border-bottom: 1px solid #f2f1f0; cursor: default; }
.nt-ol-row:hover { background: #f5f5f5; }
.nt-ol-row.on { background: #e1eefa; box-shadow: inset 3px 0 0 #0f6cbd; }
.nt-ol-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex: 0 0 8px; background: transparent; }
.nt-ol-row.unread .nt-ol-dot { background: #0f6cbd; }
.nt-ol-rtext { min-width: 0; flex: 1; }
.nt-ol-rtop { display: flex; justify-content: space-between; gap: 8px; }
.nt-ol-rtop b { font-size: 14px; }
.nt-ol-rtop i { font-style: normal; font-size: 12px; color: #605e5c; white-space: nowrap; }
.nt-ol-row.unread .nt-ol-rsub { color: #0f6cbd; font-weight: 700; }
.nt-ol-rsub { font-size: 13px; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nt-ol-rpeek { font-size: 12px; color: #605e5c; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nt-ol-pane { flex: 1; min-width: 0; background: #fff; display: flex; flex-direction: column; }

.nt-ol-compose { display: flex; flex-direction: column; flex: 1; min-height: 0; padding: 16px 22px 0; }
.nt-ol-ctitle { font-size: 17px; font-weight: 600; margin-bottom: 10px; }
.nt-ol-crow { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #edebe9; padding: 9px 0; }
.nt-ol-crow > span { width: 34px; color: #605e5c; font-size: 13px; }
.nt-ol-crow > div { flex: 1; }
.nt-ol-chip { display: inline-flex; align-items: center; gap: 7px; background: #eff6fc; border-radius: 14px;
  padding: 3px 11px 3px 4px; font-size: 13px; }
.nt-ol-chip i { width: 20px; height: 20px; border-radius: 50%; background: #a4c7e8; }
.nt-ol-csub input, .nt-ol-compose textarea { border: 0; outline: none; width: 100%; font-family: inherit;
  color: #201f1e; background: transparent; }
.nt-ol-csub input { font-size: 15px; padding: 2px 0; }
.nt-ol-format { display: flex; align-items: center; gap: 14px; padding: 9px 2px; color: #444;
  border-bottom: 1px solid #edebe9; font-size: 14px; }
.nt-ol-format b, .nt-ol-format i, .nt-ol-format u, .nt-ol-format span { cursor: default; }
.nt-ol-sep { width: 1px; height: 16px; background: #e1dfdd; }
.nt-ol-compose textarea { flex: 1; min-height: 140px; resize: none; font-size: 15px; line-height: 1.55; padding: 14px 0; }
.nt-ol-cactions { display: flex; align-items: center; gap: 10px; padding: 12px 0 16px; border-top: 1px solid #edebe9; }
.nt-ol-send, .nt-ol-discard { display: inline-flex; align-items: center; gap: 7px; border-radius: 4px;
  padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid transparent; }
.nt-ol-send { background: #0f6cbd; color: #fff; }
.nt-ol-discard { background: #fff; color: #201f1e; border-color: #8a8886; }
.nt-ol-cactions .nt-status { margin: 0; text-align: left; }

.nt-ol-read { flex: 1; min-height: 0; overflow: auto; padding: 22px 30px; }
.nt-ol-read h1 { margin: 0 0 16px; font-size: 22px; font-weight: 600; word-break: break-word; }
.nt-ol-rhead { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #edebe9; }
.nt-ol-av { width: 40px; height: 40px; border-radius: 50%; background: #c8a1e0; color: #3a1d4e;
  display: grid; place-items: center; font-weight: 700; font-size: 14px; flex: 0 0 40px; }
.nt-ol-rwho { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.nt-ol-rwho b { font-size: 15px; }
.nt-ol-rwho span { font-size: 12px; color: #605e5c; }
.nt-ol-rhead i { font-style: normal; font-size: 12px; color: #605e5c; white-space: nowrap; }
.nt-ol-rbody { font-size: 15px; line-height: 1.65; padding: 20px 0; white-space: pre-wrap; word-break: break-word; }
.nt-ol-ractions { display: flex; gap: 10px; }
.nt-ol-ractions button { display: inline-flex; align-items: center; gap: 7px; background: #fff;
  border: 1px solid #8a8886; border-radius: 4px; padding: 7px 15px; font-size: 14px; cursor: pointer; font-family: inherit; }
/* narrow screens: drop the side panes rather than squashing everything */
@media (max-width: 1100px) { .nt-ol-list { flex-basis: 260px; width: 260px; } }
@media (max-width: 900px) { .nt-ol-nav { display: none; } }
@media (max-width: 680px) { .nt-ol-list { display: none; } }

.nt-login .nt-app-body { background: linear-gradient(160deg, #eef2f9, #dfe7f5); align-items: center; justify-content: center; }
.nt-bank .nt-bar { background: #0b3d2c; }
.nt-bank .nt-app-body { background: #eef2f7; align-items: center; justify-content: center; }
.nt-card-box { background: #fff; width: min(420px, 92%); border-radius: 16px; padding: 30px 28px;
  box-shadow: 0 10px 40px rgba(20,30,60,.16); margin: 24px auto; }
.nt-card-box h2 { margin: 0 0 4px; font-size: 24px; color: #14213d; }
.nt-sub { margin: 0 0 20px; color: #6b7280; font-size: 15px; }
.nt-logo { width: 48px; height: 48px; border-radius: 13px; background: linear-gradient(135deg,#4f7df1,#7b4ff1); margin-bottom: 16px; }
.nt-card-box label { display: block; margin-bottom: 14px; font-size: 13px; color: #6b7280; }
.nt-card-box input { display: block; width: 100%; margin-top: 5px; border: 1px solid #d5d8dd; border-radius: 9px;
  padding: 12px 13px; font-size: 17px; font-family: inherit; color: #14213d; background: #fbfcfe; outline: none; }
.nt-card-box input:focus { border-color: #4f7df1; box-shadow: 0 0 0 3px rgba(79,125,241,.18); }
.nt-two { display: flex; gap: 12px; }
.nt-two label { flex: 1; }
.nt-btn { border: 0; border-radius: 9px; padding: 13px 20px; font-size: 16px; font-weight: 700;
  cursor: pointer; background: #4f7df1; color: #fff; font-family: inherit; }
.nt-block { display: block; width: 100%; margin-top: 4px; }
.nt-primary { background: #1a73e8; }
.nt-pay { background: #1f9d55; }
.nt-status { color: #1f9d55; font-size: 14px; min-height: 20px; display: block; margin-top: 10px; text-align: center; }
.nt-warn { color: #b3261e; font-size: 12px; margin: 14px 0 0; text-align: center; }
.nt-total { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px;
  padding-bottom: 14px; border-bottom: 1px solid #e6e8ec; }
.nt-total span { color: #6b7280; font-size: 14px; }
.nt-total b { font-size: 26px; color: #14213d; }
.nt-kv { display: flex; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid #eef0f3; font-size: 16px; }
.nt-kv span { color: #6b7280; }
.nt-kv b { color: #14213d; word-break: break-all; }
.nt-secret { color: #b3261e; font-family: ui-monospace, monospace; }
.nt-ok { margin-top: 20px; background: #e7f6ed; color: #1f7a45; border-radius: 9px; padding: 13px; text-align: center; font-weight: 700; }
.nt-plastic { border-radius: 14px; padding: 20px; color: #fff; background: linear-gradient(135deg,#2b3a67,#1b2a4a 60%,#24506b); }
.nt-chip { width: 42px; height: 30px; border-radius: 6px; background: linear-gradient(135deg,#e3c46b,#b8912f); margin-bottom: 18px; }
.nt-num { font-family: ui-monospace, monospace; font-size: 23px; letter-spacing: 2px; word-break: break-all; }
.nt-crow { display: flex; gap: 24px; margin-top: 16px; font-family: ui-monospace, monospace; font-size: 16px; }
.nt-crow small { display: block; font-family: inherit; font-size: 10px; letter-spacing: .6px; opacity: .7; margin-bottom: 2px; }
`;

  function injectCss() {
    if (document.getElementById("netThemeCss")) return;
    const el = document.createElement("style");
    el.id = "netThemeCss";
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  window.NetThemes = {
    SEP, SEP_SHOWN, defs, injectCss, join, splitFor, showJoined, showRaw, esc, get,
    mountSender, readFields, clearFields, noteSent,
    list: Object.keys(defs).map((id) => ({ id, label: defs[id].label })),
    renderReceiver(themeId, msgs) { return get(themeId).renderReceiver(msgs); },
  };
})();
