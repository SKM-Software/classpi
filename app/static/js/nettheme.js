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
  // A chat theme is the same shell three times over - only the palette differs.
  function chatTheme(label, cls, title, inCls, outCls) {
    return {
      label, cls, fields: null, thread: true, outCls,
      renderSender() { return shell(cls, bar(title, "online"), threadBody([], inCls), chatCompose(true)); },
      renderReceiver(msgs) { return shell(cls, bar(title, "online"), threadBody(msgs, inCls), chatCompose(false)); },
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
      label: "Email client",
      cls: "nt-mail",
      fields: [
        { id: "subject", label: "Subject", placeholder: "Subject" },
        { id: "body", label: "Message", placeholder: "Write your message...", area: true },
      ],
      renderSender() {
        return shell("nt-mail", bar("Mail", "New message"), `
          <div class="nt-sheet">
            <div class="nt-mrow"><span>To</span><div class="nt-mto">the other Pi</div></div>
            <div class="nt-mrow"><span>Subject</span>
              <input type="text" class="nt-flat" data-field="subject" placeholder="Subject" autocomplete="off"></div>
            <textarea class="nt-flat nt-area" data-field="body" placeholder="Write your message..."></textarea>
            <div class="nt-actions"><button type="button" class="nt-btn nt-primary" data-send>Send</button>
              <span class="nt-status" data-status></span></div>
          </div>`);
      },
      renderReceiver(msgs) {
        const m = msgs[0];
        const [subject, body] = splitFor("email", m.plain != null ? m.plain : m.payload);
        const list = msgs.slice(0, 8).map((x, i) => {
          const [s] = splitFor("email", x.plain != null ? x.plain : x.payload);
          return `<div class="nt-li ${i === 0 ? "on" : ""}"><b>${esc(x.from || "?")}</b>
            <span>${esc(s) || "(no subject)"}</span><i>${esc(hhmm(x.at))}</i></div>`;
        }).join("");
        return shell("nt-mail", bar("Mail", "Inbox"), `
          <div class="nt-split">
            <div class="nt-list">${list}</div>
            <div class="nt-read">
              <h2>${esc(subject) || "(no subject)"}</h2>
              <div class="nt-from"><span class="nt-avatar"></span> from ${esc(m.from || "?")} &middot; ${esc(hhmm(m.at))}</div>
              <div class="nt-mbody">${esc(body) || "(empty message)"}</div>
            </div>
          </div>`);
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

.nt-wa .nt-bar { background: #075e54; }
.nt-wa .nt-app-body, .nt-wa .nt-thread { background: #ece5dd; }
.nt-wa .nt-compose { background: #f0f0f0; }
.nt-wa .nt-send { background: #25d366; }
.nt-wa-in { background: #fff; }
.nt-wa-out { background: #dcf8c6; }

.nt-msgr .nt-bar { background: #0084ff; }
.nt-msgr .nt-app-body, .nt-msgr .nt-thread { background: #fff; }
.nt-msgr .nt-compose { background: #f2f3f5; }
.nt-msgr .nt-in { background: #eceff1; }
.nt-msgr .nt-send { background: #0084ff; }
.nt-msgr-in { background: #eceff1; }
.nt-msgr-out { background: #0084ff; color: #fff; }

.nt-sms .nt-bar { background: #3b3b3d; }
.nt-sms .nt-app-body, .nt-sms .nt-thread { background: #fff; }
.nt-sms .nt-compose { background: #f6f6f6; }
.nt-sms .nt-in { background: #eceff1; }
.nt-sms .nt-send { background: #1d8cf8; }
.nt-sms-in { background: #e9e9eb; }
.nt-sms-out { background: #1d8cf8; color: #fff; }

.nt-mail .nt-bar { background: #1a73e8; }
.nt-mail .nt-app-body { background: #f6f8fc; }
.nt-sheet { background: #fff; margin: 22px auto; width: min(760px, 94%); border-radius: 12px;
  box-shadow: 0 2px 14px rgba(0,0,0,.12); padding: 18px 20px; }
.nt-mrow { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #e6e8ec; padding: 10px 0; }
.nt-mrow > span { width: 70px; color: #5f6368; font-size: 14px; }
.nt-mto { color: #202124; }
.nt-flat { border: 0; outline: none; font-size: 17px; width: 100%; font-family: inherit; color: #202124; background: transparent; }
.nt-area { min-height: 220px; resize: vertical; padding: 16px 0; line-height: 1.5; }
.nt-actions { display: flex; align-items: center; gap: 14px; padding-top: 12px; border-top: 1px solid #e6e8ec; }
.nt-split { display: flex; flex: 1; min-height: 0; }
.nt-list { width: 300px; border-right: 1px solid #e0e3e8; overflow: auto; background: #fff; }
.nt-li { padding: 13px 16px; border-bottom: 1px solid #eef0f3; font-size: 14px; cursor: default; }
.nt-li.on { background: #e8f0fe; }
.nt-li b { display: block; color: #202124; }
.nt-li span { display: block; color: #5f6368; margin-top: 2px; }
.nt-li i { color: #9aa0a6; font-style: normal; font-size: 12px; }
.nt-read { flex: 1; padding: 26px 32px; overflow: auto; background: #fff; }
.nt-read h2 { margin: 0 0 12px; font-size: 24px; color: #202124; font-weight: 500; }
.nt-from { display: flex; align-items: center; gap: 10px; color: #5f6368; font-size: 14px; margin-bottom: 18px; }
.nt-from .nt-avatar { background: #c8d6e5; width: 30px; height: 30px; flex: 0 0 30px; }
.nt-mbody { font-size: 17px; line-height: 1.6; color: #202124; white-space: pre-wrap; word-break: break-word; }

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
