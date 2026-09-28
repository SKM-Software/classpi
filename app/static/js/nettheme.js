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
  function threadBody(msgs, inCls) {
    const rows = msgs.slice(0, 30).reverse().map((m) => {
      const text = m.plain != null ? m.plain : m.payload;
      return bubbleHtml(inCls, text, false, hhmm(m.at));
    }).join("");
    return `<div class="nt-thread" data-thread>${rows}</div>` +
      (msgs.length ? "" : `<div class="nt-empty" data-empty>No messages yet</div>`);
  }
  function bubbleHtml(cls, text, out, time, ticks) {
    return `<div class="nt-row ${out ? "nt-r" : "nt-l"}"><div class="nt-bubble ${cls}">` +
      `${esc(text)}<span class="nt-time">${esc(time || "")}${out && ticks ? " " + ticks : ""}</span>` +
      `</div></div>`;
  }
  const field = (live, ph, cls) =>
    `<input type="text" class="${cls}" data-field="message" placeholder="${esc(ph)}"
            autocomplete="off" ${live ? "" : "disabled"}>`;
  const sendBtn = (live, cls, icon) =>
    `<button type="button" class="${cls}" ${live ? "data-send" : "disabled"} title="Send">${icon}</button>`;
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
    back: "M15 5l-7 7 7 7",
    video: "M3 7h11v10H3zM14 11l6-3v8l-6-3",
    phone: "M6 3l3 5-2 2a12 12 0 0 0 5 5l2-2 5 3-1 4a17 17 0 0 1-15-15z",
    kebab: "M12 6h.01M12 12h.01M12 18h.01",
    info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 8h.01",
    smile: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 10h.01M15 10h.01M8.5 14a5 5 0 0 0 7 0",
    clip: "M20 11l-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8",
    cam: "M3 8h4l2-2h6l2 2h4v11H3zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    mic: "M12 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v3",
    plus: "M12 4v16M4 12h16",
    image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6",
    thumb: "M7 21V10l5-7 1 1-1 5h6a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2z",
    up: "M12 19V5M6 11l6-6 6 6",
    apps: "M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z",
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

  // ------------------------------------------------------------ website chrome
  // A whole site rather than a floating card: nav, page content, footer - so
  // the login looks like somewhere you would really type a password.
  function site(cls, head, body, foot) {
    return `<div class="nt-app ${cls}">${head}<div class="nt-site-body">${body}</div>${foot || ""}</div>`;
  }
  function siteHead(account) {
    const links = ["Home", "Courses", "Students", "Staff", "Library", "Contact"]
      .map((l, i) => `<a class="${i === 2 ? "on" : ""}">${l}</a>`).join("");
    return `<header class="nt-site-head">
      <span class="nt-site-brand"><span class="nt-site-mark"></span>Clyde Academy</span>
      <nav>${links}</nav>
      <span class="nt-site-acct">${account ? `${esc(account)} &middot; Sign out` : "Sign in"}</span>
    </header>`;
  }
  function siteFoot() {
    return `<footer class="nt-site-foot">
      <span>&copy; Clyde Academy</span>
      <span>Privacy &middot; Accessibility &middot; Acceptable use &middot; Help desk</span>
    </footer>`;
  }

  // Online shop: header, department bar, then the checkout columns.
  function shop(body) {
    const depts = ["All", "Today's Deals", "Electronics", "Computing", "Books", "Gift Cards", "Sell"]
      .map((d, i) => `<a class="${i === 0 ? "on" : ""}">${d}</a>`).join("");
    return `<div class="nt-app nt-bank">
      <header class="nt-shop-head">
        <span class="nt-shop-logo">clydemart</span>
        <span class="nt-shop-to"><small>Deliver to</small>Glasgow G12</span>
        <span class="nt-shop-search"><input type="text" placeholder="Search clydemart" disabled>
          <b>${ic("search", 17)}</b></span>
        <span class="nt-shop-acct"><small>Hello, Ava</small>Account &amp; Lists</span>
        <span class="nt-shop-acct"><small>Returns</small>&amp; Orders</span>
        <span class="nt-shop-cart">${ic("inbox", 20)}<i>1</i></span>
      </header>
      <div class="nt-shop-nav">${depts}</div>
      <div class="nt-checkout">${body}</div>
    </div>`;
  }

  // Each chat app gets its own header, compose bar and bubble shape - the three
  // look different enough in real life that a shared shell reads as none of them.
  function chatTheme(cfg) {
    return {
      label: cfg.label, cls: cfg.cls, fields: null, thread: true, phone: true,
      outCls: cfg.outCls,
      renderSender() {
        return phoneShell(cfg.cls, cfg.header(), threadBody([], cfg.inCls), cfg.compose(true));
      },
      renderReceiver(msgs) {
        return phoneShell(cfg.cls, cfg.header(), threadBody(msgs, cfg.inCls), cfg.compose(false));
      },
      noteSent(root, values) {
        const th = root.querySelector("[data-thread]");
        const empty = root.querySelector("[data-empty]");
        if (empty) empty.remove();
        root.querySelectorAll(".nt-delivered").forEach((el) => el.remove());
        th.insertAdjacentHTML("beforeend",
          bubbleHtml(cfg.outCls, values[0], true, hhmm(), cfg.ticks) + (cfg.delivered || ""));
        th.scrollTop = th.scrollHeight;
      },
    };
  }

  const WA_TICKS = '<span class="nt-tick">&#10003;&#10003;</span>';

  const CHATS = {
    whatsapp: {
      label: "Chat (WhatsApp-style)", cls: "nt-wa", inCls: "nt-wa-in", outCls: "nt-wa-out",
      ticks: WA_TICKS,
      header: () => `<div class="nt-wa-bar">
        ${ic("back", 22)}<span class="nt-avatar"></span>
        <div class="nt-bar-t"><b>Class chat</b><span>online</span></div>
        <span class="nt-wa-acts">${ic("video", 21)}${ic("phone", 19)}${ic("kebab", 20)}</span>
      </div>`,
      compose: (live) => `<div class="nt-wa-compose">
        <div class="nt-wa-pill">${ic("smile", 21)}${field(live, "Message", "nt-in")}
          ${ic("clip", 20)}${ic("cam", 20)}</div>
        ${sendBtn(live, "nt-wa-send", ic("up", 21))}
      </div>`,
    },
    messenger: {
      label: "Chat (Messenger-style)", cls: "nt-msgr", inCls: "nt-msgr-in", outCls: "nt-msgr-out",
      header: () => `<div class="nt-msgr-bar">
        ${ic("back", 22)}<span class="nt-avatar"><i class="nt-online"></i></span>
        <div class="nt-bar-t"><b>Class chat</b><span>Active now</span></div>
        <span class="nt-msgr-acts">${ic("phone", 20)}${ic("video", 21)}${ic("info", 20)}</span>
      </div>`,
      compose: (live) => `<div class="nt-msgr-compose">
        <span class="nt-msgr-icons">${ic("plus", 21)}${ic("cam", 20)}${ic("image", 20)}${ic("mic", 19)}</span>
        <div class="nt-msgr-pill">${field(live, "Aa", "nt-in")}${ic("smile", 20)}</div>
        ${sendBtn(live, "nt-msgr-send", ic("thumb", 21))}
      </div>`,
    },
    sms: {
      label: "Text messages (iMessage-style)", cls: "nt-sms", inCls: "nt-sms-in", outCls: "nt-sms-out",
      delivered: '<div class="nt-delivered">Delivered</div>',
      header: () => `<div class="nt-sms-bar">
        <span class="nt-sms-back">${ic("back", 24)}</span>
        <div class="nt-sms-who"><span class="nt-avatar"></span><b>Class chat &rsaquo;</b></div>
        <span class="nt-sms-acts">${ic("video", 22)}</span>
      </div>`,
      compose: (live) => `<div class="nt-sms-compose">
        ${ic("apps", 21)}
        <div class="nt-sms-pill">${field(live, "iMessage", "nt-in")}
          ${sendBtn(live, "nt-sms-send", ic("up", 17))}</div>
      </div>`,
    },
  };

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

    whatsapp:  chatTheme(CHATS.whatsapp),
    messenger: chatTheme(CHATS.messenger),
    sms:       chatTheme(CHATS.sms),

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
      label: "Website login page",
      cls: "nt-login",
      fields: [
        { id: "username", label: "Username", placeholder: "Username" },
        { id: "password", label: "Password", placeholder: "Password", type: "password" },
      ],
      renderSender() {
        return site("nt-login", siteHead(), `
          <div class="nt-hero">
            <div class="nt-hero-txt">
              <h1>Student Portal</h1>
              <p>Sign in to see your timetable, submit coursework, check results
                 and message your teachers.</p>
              <ul class="nt-ticks"><li>Timetable and room changes</li>
                <li>Submit and track coursework</li><li>Results and reports</li></ul>
            </div>
            <div class="nt-signin">
              <h2>Sign in</h2>
              <p class="nt-sub">Use your school account</p>
              <label>Username<input type="text" data-field="username" placeholder="firstname.surname" autocomplete="off"></label>
              <label>Password<input type="password" data-field="password" placeholder="Password" autocomplete="off"></label>
              <div class="nt-srow"><span><i class="nt-box"></i> Remember me</span><a>Forgot password?</a></div>
              <button type="button" class="nt-signin-btn" data-send>Sign in</button>
              <div class="nt-status" data-status></div>
              <p class="nt-fine">By signing in you accept the school's acceptable use policy.</p>
            </div>
          </div>`, siteFoot());
      },
      renderReceiver(msgs) {
        const m = msgs[0];
        const [user, pass] = splitFor("login", m.plain != null ? m.plain : m.payload);
        return site("nt-login", siteHead(esc(user) || "signed in"), `
          <div class="nt-hero nt-hero-in">
            <div class="nt-signin nt-wide">
              <div class="nt-ok">&#10003; Signed in as ${esc(user) || "(no username)"}</div>
              <h2>What the server received</h2>
              <p class="nt-sub">The login was checked against the account database and accepted.</p>
              <div class="nt-kv"><span>Username</span><b>${esc(user)}</b></div>
              <div class="nt-kv"><span>Password</span><b class="nt-secret">${esc(pass)}</b></div>
              <p class="nt-note">The login page hid the password behind dots. The network did not.</p>
            </div>
          </div>`, siteFoot());
      },
      noteSent(root) { status(root, "Signing in..."); },
    },

    banking: {
      label: "Online shop checkout",
      cls: "nt-bank",
      warn: "Demo data only - never type a real card number.",
      fields: [
        { id: "card", label: "Card number", placeholder: "4000 1234 5678 9010", max: 24 },
        { id: "expiry", label: "Expiry", placeholder: "09/28", max: 7 },
        { id: "cvv", label: "Security code", placeholder: "311", max: 4 },
      ],
      renderSender() {
        return shop(`
          <div class="nt-co-main">
            <h1>Checkout</h1>
            <section class="nt-co-sec">
              <h3><i>1</i> Delivery address</h3>
              <p>Ava McLeod<br>14 Kelvin Way, Glasgow, G12 8QQ</p>
              <a>Change</a>
            </section>
            <section class="nt-co-sec nt-co-open">
              <h3><i>2</i> Payment method</h3>
              <div class="nt-co-cards"><span class="nt-cbadge">VISA</span><span class="nt-cbadge alt">MC</span>
                <span class="nt-cbadge alt2">AMEX</span></div>
              <label>Card number<input type="text" data-field="card" maxlength="24"
                placeholder="4000 1234 5678 9010" autocomplete="off"></label>
              <div class="nt-two">
                <label>Expiry<input type="text" data-field="expiry" maxlength="7" placeholder="09/28" autocomplete="off"></label>
                <label>Security code<input type="text" data-field="cvv" maxlength="4" placeholder="311" autocomplete="off"></label>
              </div>
              <p class="nt-warn">Demo data only - never type a real card number.</p>
            </section>
            <section class="nt-co-sec">
              <h3><i>3</i> Review items and delivery</h3>
              <div class="nt-co-item"><span class="nt-co-thumb"></span>
                <div><b>Raspberry Pi 5 starter kit (8GB)</b>
                  <div class="nt-co-meta">In stock &middot; Sold by ClydeTech</div>
                  <div class="nt-co-price">&pound;24.99</div></div></div>
              <div class="nt-co-deliv"><b>Delivery:</b> Tomorrow, free with Prime-style delivery</div>
            </section>
          </div>
          <aside class="nt-co-side">
            <button type="button" class="nt-place" data-send>Place your order</button>
            <div class="nt-status" data-status></div>
            <p class="nt-fine">By placing your order you agree to the shop's terms of sale.</p>
            <h4>Order Summary</h4>
            <div class="nt-sum"><span>Items (1)</span><b>&pound;24.99</b></div>
            <div class="nt-sum"><span>Delivery</span><b>&pound;0.00</b></div>
            <div class="nt-sum nt-total-row"><span>Order total</span><b>&pound;24.99</b></div>
          </aside>`);
      },
      renderReceiver(msgs) {
        const m = msgs[0];
        const [num, expiry, cvv] = splitFor("banking", m.plain != null ? m.plain : m.payload);
        return shop(`
          <div class="nt-co-main">
            <div class="nt-ok">&#10003; Order placed - thank you</div>
            <section class="nt-co-sec nt-co-open">
              <h3><i>&#10003;</i> Payment details received</h3>
              <div class="nt-plastic">
                <div class="nt-chip"></div>
                <div class="nt-num">${esc(num) || "&bull;&bull;&bull;&bull;"}</div>
                <div class="nt-crow"><span><small>EXPIRES</small>${esc(expiry) || "--/--"}</span>
                  <span><small>SECURITY CODE</small>${esc(cvv) || "---"}</span></div>
              </div>
            </section>
            <section class="nt-co-sec">
              <h3>Dispatching to</h3>
              <p>Ava McLeod<br>14 Kelvin Way, Glasgow, G12 8QQ</p>
            </section>
          </div>
          <aside class="nt-co-side">
            <h4>Order Summary</h4>
            <div class="nt-sum"><span>Items (1)</span><b>&pound;24.99</b></div>
            <div class="nt-sum"><span>Delivery</span><b>&pound;0.00</b></div>
            <div class="nt-sum nt-total-row"><span>Order total</span><b>&pound;24.99</b></div>
            <p class="nt-fine">A confirmation email is on its way.</p>
          </aside>`);
      },
      noteSent(root) { status(root, "Placing your order..."); },
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

/* --- phone mockup shared by the chat apps --- */
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
.nt-bar-t { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; flex: 1; }
.nt-bar-t b { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nt-bar-t span { font-size: 12px; opacity: .85; }
.nt-avatar { width: 32px; height: 32px; border-radius: 50%; flex: 0 0 32px; position: relative;
  background: linear-gradient(135deg, #b9c6d8, #8fa3bd); }

.nt-thread { flex: 1; min-height: 0; overflow: auto; padding: 14px 10px; display: flex;
  flex-direction: column; gap: 3px; }
.nt-empty { text-align: center; color: #98a0ad; padding: 26px; font-size: 16px; }
.nt-row { display: flex; width: 100%; }
.nt-row.nt-l { justify-content: flex-start; }
.nt-row.nt-r { justify-content: flex-end; }
.nt-bubble { position: relative; max-width: 78%; padding: 7px 10px 6px; font-size: 16px;
  line-height: 1.35; word-break: break-word; }
.nt-time { display: block; font-size: 11px; opacity: .5; text-align: right; margin-top: 2px; }
.nt-in { flex: 1; border: 0; background: transparent; font-size: 16px; font-family: inherit;
  color: #111; outline: none; min-width: 0; padding: 0; }
.nt-in::placeholder { color: #9aa0a6; }
.nt-in:disabled { opacity: .8; }
.nt-delivered { align-self: flex-end; font-size: 11px; color: #8e8e93; padding: 2px 4px 0; }

/* --- WhatsApp-style --- */
.nt-wa-bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; flex: 0 0 auto;
  background: #008069; color: #fff; }
.nt-wa-acts { display: inline-flex; align-items: center; gap: 15px; }
.nt-wa .nt-sbar { background: #008069; color: #fff; }
/* the cream wallpaper, faintly textured like the real one */
.nt-wa .nt-thread { background-color: #efeae2;
  background-image: radial-gradient(circle at 18% 22%, rgba(0,0,0,.028) 2.5px, transparent 3px),
    radial-gradient(circle at 72% 58%, rgba(0,0,0,.028) 2.5px, transparent 3px),
    radial-gradient(circle at 42% 84%, rgba(0,0,0,.022) 2px, transparent 2.5px);
  background-size: 110px 110px, 150px 150px, 90px 90px; }
.nt-wa-in, .nt-wa-out { border-radius: 8px; box-shadow: 0 1px .5px rgba(11,20,26,.13); }
.nt-wa-in { background: #fff; border-top-left-radius: 0; margin-left: 8px; }
.nt-wa-out { background: #d9fdd3; border-top-right-radius: 0; margin-right: 8px; }
.nt-wa-in::before { content: ""; position: absolute; top: 0; left: -8px;
  border-top: 9px solid #fff; border-left: 8px solid transparent; }
.nt-wa-out::after { content: ""; position: absolute; top: 0; right: -8px;
  border-top: 9px solid #d9fdd3; border-right: 8px solid transparent; }
.nt-wa .nt-tick { color: #53bdeb; font-size: 12px; }
.nt-wa-compose { display: flex; align-items: flex-end; gap: 7px; padding: 7px 8px; flex: 0 0 auto;
  background: #efeae2; }
.nt-wa-pill { flex: 1; display: flex; align-items: center; gap: 9px; background: #fff;
  border-radius: 24px; padding: 9px 13px; color: #8696a0; min-width: 0; }
.nt-wa-send { width: 44px; height: 44px; border-radius: 50%; border: 0; flex: 0 0 44px;
  background: #00a884; color: #fff; display: grid; place-items: center; cursor: pointer; }
.nt-wa-send:disabled { opacity: .5; cursor: default; }
.nt-wa .nt-home { background: #efeae2; }

/* --- Messenger-style --- */
.nt-msgr-bar { display: flex; align-items: center; gap: 10px; padding: 7px 12px; flex: 0 0 auto;
  background: #fff; color: #050505; border-bottom: 1px solid #eceff1; }
.nt-msgr-bar > svg:first-child, .nt-msgr-acts { color: #0084ff; }
.nt-msgr-acts { display: inline-flex; align-items: center; gap: 17px; }
.nt-msgr .nt-bar-t b { font-size: 15px; }
.nt-msgr .nt-bar-t span { color: #65676b; font-size: 11px; }
.nt-online { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px;
  border-radius: 50%; background: #31a24c; border: 2px solid #fff; }
.nt-msgr .nt-sbar { background: #fff; color: #050505; }
.nt-msgr .nt-thread { background: #fff; gap: 2px; }
.nt-msgr-in, .nt-msgr-out { border-radius: 18px; padding: 8px 12px; }
.nt-msgr-in { background: #f0f0f0; color: #050505; }
.nt-msgr-out { background: #0084ff; color: #fff; }
.nt-msgr-out .nt-time { opacity: .75; }
.nt-msgr-compose { display: flex; align-items: center; gap: 12px; padding: 8px 12px; flex: 0 0 auto;
  background: #fff; }
.nt-msgr-icons { display: inline-flex; align-items: center; gap: 13px; color: #0084ff; flex: 0 0 auto; }
.nt-msgr-pill { flex: 1; display: flex; align-items: center; gap: 8px; background: #f0f2f5;
  border-radius: 20px; padding: 8px 12px; color: #65676b; min-width: 0; }
.nt-msgr-pill .nt-in { background: transparent; }
.nt-msgr-send { border: 0; background: none; color: #0084ff; cursor: pointer; padding: 0;
  display: grid; place-items: center; flex: 0 0 auto; }
.nt-msgr-send:disabled { opacity: .5; cursor: default; }
.nt-msgr .nt-home { background: #fff; }

/* --- iMessage-style --- */
.nt-sms-bar { display: flex; align-items: center; padding: 4px 10px 9px; flex: 0 0 auto;
  background: #f6f6f6; border-bottom: 1px solid #d8d8dc; color: #007aff; }
.nt-sms-back { flex: 0 0 34px; }
.nt-sms-who { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.nt-sms-who .nt-avatar { width: 30px; height: 30px; flex-basis: 30px; }
.nt-sms-who b { font-size: 12px; color: #000; font-weight: 500; }
.nt-sms-acts { flex: 0 0 34px; text-align: right; }
.nt-sms .nt-sbar { background: #f6f6f6; color: #000; }
.nt-sms .nt-thread { background: #fff; gap: 3px; }
.nt-sms-in, .nt-sms-out { border-radius: 19px; padding: 8px 13px; }
.nt-sms-in { background: #e9e9eb; color: #000; border-bottom-left-radius: 5px; }
.nt-sms-out { background: #1d8cf8; color: #fff; border-bottom-right-radius: 5px; }
.nt-sms-in .nt-time, .nt-sms-out .nt-time { display: none; }
.nt-sms-compose { display: flex; align-items: center; gap: 10px; padding: 8px 10px; flex: 0 0 auto;
  background: #f6f6f6; color: #8e8e93; }
.nt-sms-pill { flex: 1; display: flex; align-items: center; gap: 8px; background: #fff;
  border: 1px solid #d3d3d8; border-radius: 19px; padding: 6px 6px 6px 13px; min-width: 0; }
.nt-sms-send { width: 29px; height: 29px; border-radius: 50%; border: 0; flex: 0 0 29px;
  background: #1d8cf8; color: #fff; display: grid; place-items: center; cursor: pointer; }
.nt-sms-send:disabled { background: #c7c7cc; cursor: default; }
.nt-sms .nt-home { background: #f6f6f6; }

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

/* --- full website (login page) --- */
.nt-login { background: #f4f6fa; color: #1b2330; font-size: 15px; }
.nt-site-head { display: flex; align-items: center; gap: 26px; padding: 0 30px; height: 62px;
  background: #13294b; color: #fff; flex: 0 0 auto; }
.nt-site-brand { display: flex; align-items: center; gap: 11px; font-size: 18px; font-weight: 700; }
.nt-site-mark { width: 30px; height: 30px; border-radius: 7px;
  background: linear-gradient(135deg, #4fd1a5, #5b9dff); }
.nt-site-head nav { display: flex; gap: 22px; font-size: 14px; }
.nt-site-head nav a { color: #cfd9e8; cursor: default; padding: 4px 0; }
.nt-site-head nav a.on { color: #fff; border-bottom: 2px solid #4fd1a5; }
.nt-site-acct { margin-left: auto; font-size: 14px; color: #cfd9e8; }
.nt-site-body { flex: 1; min-height: 0; overflow: auto; }
.nt-hero { display: grid; grid-template-columns: 1.1fr 400px; gap: 46px; align-items: center;
  max-width: 1080px; margin: 0 auto; padding: 52px 30px; }
.nt-hero-in { grid-template-columns: 1fr; max-width: 640px; }
.nt-hero-txt h1 { font-size: 40px; margin: 0 0 14px; letter-spacing: -.5px; }
.nt-hero-txt p { font-size: 17px; line-height: 1.6; color: #4a5568; margin: 0 0 22px; }
.nt-ticks { list-style: none; padding: 0; margin: 0; color: #3b4658; }
.nt-ticks li { padding: 7px 0 7px 28px; position: relative; }
.nt-ticks li::before { content: "✓"; position: absolute; left: 0; color: #1f9d55; font-weight: 700; }
.nt-signin { background: #fff; border-radius: 14px; padding: 30px 28px;
  box-shadow: 0 10px 40px rgba(20,34,64,.13); border: 1px solid #e6eaf1; }
.nt-signin.nt-wide { margin: 0 auto; }
.nt-signin h2 { margin: 0 0 4px; font-size: 24px; }
.nt-signin .nt-sub { margin: 0 0 20px; color: #6b7785; font-size: 14px; }
.nt-signin label { display: block; margin-bottom: 15px; font-size: 13px; color: #55606f; }
.nt-signin input { display: block; width: 100%; margin-top: 6px; border: 1px solid #ccd4e0;
  border-radius: 8px; padding: 12px 13px; font-size: 16px; font-family: inherit; color: #1b2330;
  background: #fff; outline: none; }
.nt-signin input:focus { border-color: #13294b; box-shadow: 0 0 0 3px rgba(19,41,75,.13); }
.nt-srow { display: flex; justify-content: space-between; align-items: center; font-size: 13px;
  color: #55606f; margin-bottom: 18px; }
.nt-srow a { color: #1258a8; cursor: default; }
.nt-box { display: inline-block; width: 13px; height: 13px; border: 1px solid #aab4c2;
  border-radius: 3px; vertical-align: -2px; margin-right: 5px; }
.nt-signin-btn { width: 100%; background: #13294b; color: #fff; border: 0; border-radius: 8px;
  padding: 13px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; }
.nt-fine { font-size: 12px; color: #8a94a3; margin: 14px 0 0; }
.nt-note { margin-top: 16px; font-size: 13px; color: #b3261e; }
.nt-site-foot { display: flex; justify-content: space-between; gap: 20px; padding: 18px 30px;
  background: #13294b; color: #9fb0c8; font-size: 13px; flex: 0 0 auto; }

/* --- online shop checkout --- */
.nt-bank { background: #eaeded; color: #0f1111; font-size: 14px; }
.nt-shop-head { display: flex; align-items: center; gap: 18px; padding: 0 16px; height: 58px;
  background: #131921; color: #fff; flex: 0 0 auto; }
.nt-shop-logo { font-size: 21px; font-weight: 800; letter-spacing: -.5px; }
.nt-shop-logo::after { content: ""; display: block; height: 3px; border-radius: 2px;
  background: #ff9900; margin-top: -3px; }
.nt-shop-to, .nt-shop-acct { display: flex; flex-direction: column; line-height: 1.25; font-size: 14px; font-weight: 700; }
.nt-shop-to small, .nt-shop-acct small { font-size: 11px; font-weight: 400; color: #ccc; }
.nt-shop-search { flex: 1; display: flex; min-width: 0; }
.nt-shop-search input { flex: 1; min-width: 0; border: 0; border-radius: 4px 0 0 4px; padding: 9px 12px;
  font-size: 15px; font-family: inherit; background: #fff; color: #111; }
.nt-shop-search b { display: grid; place-items: center; width: 44px; background: #febd69;
  color: #111; border-radius: 0 4px 4px 0; }
.nt-shop-cart { position: relative; display: flex; align-items: flex-end; font-weight: 700; }
.nt-shop-cart i { font-style: normal; color: #f08804; font-weight: 800; margin-left: 3px; }
.nt-shop-nav { display: flex; gap: 18px; padding: 8px 18px; background: #232f3e; color: #fff;
  font-size: 13px; flex: 0 0 auto; }
.nt-shop-nav a { cursor: default; }
.nt-shop-nav a.on { font-weight: 700; }
.nt-checkout { flex: 1; min-height: 0; overflow: auto; display: grid;
  grid-template-columns: 1fr 300px; gap: 20px; align-items: start;
  max-width: 1180px; margin: 0 auto; padding: 22px 20px; width: 100%; }
.nt-co-main h1 { font-size: 27px; font-weight: 400; margin: 0 0 16px;
  padding-bottom: 12px; border-bottom: 1px solid #ddd; }
.nt-co-sec { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px 20px; margin-bottom: 14px; position: relative; }
.nt-co-sec h3 { display: flex; align-items: center; gap: 9px; margin: 0 0 10px; font-size: 17px; }
.nt-co-sec h3 i { font-style: normal; width: 22px; height: 22px; border-radius: 50%; background: #232f3e;
  color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; flex: 0 0 22px; }
.nt-co-sec p { margin: 0; line-height: 1.6; }
.nt-co-sec > a { position: absolute; top: 18px; right: 20px; color: #007185; font-size: 13px; cursor: default; }
.nt-co-open { border-color: #b8b8b8; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.nt-co-cards { display: flex; gap: 8px; margin-bottom: 14px; }
.nt-cbadge { font-size: 11px; font-weight: 800; letter-spacing: .5px; color: #fff; background: #1a1f71;
  border-radius: 3px; padding: 4px 8px; }
.nt-cbadge.alt { background: #eb001b; }
.nt-cbadge.alt2 { background: #006fcf; }
.nt-co-sec label { display: block; margin-bottom: 12px; font-size: 13px; color: #565959; font-weight: 700; }
.nt-co-sec input { display: block; width: 100%; margin-top: 5px; border: 1px solid #888c8c;
  border-radius: 4px; padding: 9px 11px; font-size: 15px; font-family: inherit; color: #0f1111;
  background: #fff; outline: none; box-shadow: inset 0 1px 2px rgba(15,17,17,.12); font-weight: 400; }
.nt-co-sec input:focus { border-color: #007185; box-shadow: 0 0 3px 2px rgba(0,113,133,.4); }
.nt-two { display: flex; gap: 14px; }
.nt-two label { flex: 1; }
.nt-co-item { display: flex; gap: 16px; align-items: flex-start; }
.nt-co-thumb { width: 74px; height: 74px; border-radius: 6px; flex: 0 0 74px;
  background: linear-gradient(135deg, #3f4b66, #1f2937); }
.nt-co-item b { font-size: 15px; }
.nt-co-meta { color: #565959; font-size: 13px; margin-top: 3px; }
.nt-co-price { color: #b12704; font-weight: 700; font-size: 16px; margin-top: 5px; }
.nt-co-deliv { margin-top: 14px; padding-top: 12px; border-top: 1px solid #eee; font-size: 13px; color: #007600; }
.nt-co-side { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 18px; position: sticky; top: 0; }
.nt-place { width: 100%; background: #ffd814; border: 1px solid #fcd200; border-radius: 20px;
  padding: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; color: #0f1111; }
.nt-co-side h4 { margin: 16px 0 10px; font-size: 17px; padding-top: 14px; border-top: 1px solid #ddd; }
.nt-sum { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
.nt-total-row { color: #b12704; font-weight: 700; font-size: 17px; margin-top: 8px;
  padding-top: 10px; border-top: 1px solid #ddd; }
.nt-co-side .nt-fine { margin-top: 10px; }
.nt-ok { background: #e7f6ed; color: #1f7a45; border-radius: 8px; padding: 14px 16px;
  font-weight: 700; margin-bottom: 14px; }
.nt-kv { display: flex; justify-content: space-between; gap: 14px; padding: 12px 0;
  border-bottom: 1px solid #eef0f3; font-size: 16px; }
.nt-kv span { color: #6b7280; }
.nt-kv b { color: #14213d; word-break: break-all; }
.nt-secret { color: #b3261e; font-family: ui-monospace, monospace; }
.nt-warn { color: #b12704; font-size: 12px; margin: 10px 0 0; }
.nt-plastic { border-radius: 12px; padding: 20px; color: #fff; max-width: 400px;
  background: linear-gradient(135deg,#2b3a67,#1b2a4a 60%,#24506b); }
.nt-chip { width: 42px; height: 30px; border-radius: 6px; background: linear-gradient(135deg,#e3c46b,#b8912f); margin-bottom: 18px; }
.nt-num { font-family: ui-monospace, monospace; font-size: 22px; letter-spacing: 2px; word-break: break-all; }
.nt-crow { display: flex; gap: 24px; margin-top: 16px; font-family: ui-monospace, monospace; font-size: 15px; }
.nt-crow small { display: block; font-family: inherit; font-size: 10px; letter-spacing: .6px; opacity: .7; margin-bottom: 2px; }
@media (max-width: 950px) {
  .nt-hero { grid-template-columns: 1fr; gap: 28px; padding: 28px 20px; }
  .nt-checkout { grid-template-columns: 1fr; }
  .nt-site-head nav, .nt-shop-to, .nt-shop-acct { display: none; }
}
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
