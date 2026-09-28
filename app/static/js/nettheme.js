// ClassPi Network Lab - app themes.
//
// Skins the sender preview and the receiver screen to look like real apps, so
// pupils see that the encryption ideas apply to software they actually use.
// The middle (spy) screen is deliberately never themed - the whole point is
// that the friendly interface is skin deep and the network only sees bytes.
//
// These are CSS-drawn pastiches. No real logos, brand assets or trademarks.
(function () {
  const SEP = "";        // unit separator: joins multi-field messages
  const SEP_SHOWN = "␟";  // the visible glyph used in raw (spy) views

  const esc = (s) => String(s == null ? "" : s)
    .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ------------------------------------------------------------ definitions
  const defs = {
    classic: {
      label: "Classic",
      fields: null,
      renderReceiver(msgs) {
        const m = msgs[0];
        const text = m.plain != null ? m.plain : m.payload;
        const label = (m.scheme || "none") === "none"
          ? "received (was plaintext)" : "decoded with the shared setup";
        return `<div><div class="chip">${esc(label)}</div>
          <div style="font-size:6vmin;font-weight:800;color:#cffbe9;margin-top:14px;word-break:break-word">${esc(text)}</div></div>`;
      },
      renderPreview(v) {
        return `<div class="nt-plain">${esc(v[0]) || '<span class="nt-dim">(nothing typed yet)</span>'}</div>`;
      },
    },

    whatsapp: {
      label: "Chat (WhatsApp-style)",
      fields: null, thread: true,
      renderReceiver(msgs) { return phone("nt-wa", "Chat", bubbles(msgs, "nt-wa-in")); },
      renderPreview(v) { return phone("nt-wa", "Chat", bubble("nt-wa-out", v[0], true)); },
    },

    messenger: {
      label: "Chat (Messenger-style)",
      fields: null, thread: true,
      renderReceiver(msgs) { return phone("nt-msgr", "Messages", bubbles(msgs, "nt-msgr-in")); },
      renderPreview(v) { return phone("nt-msgr", "Messages", bubble("nt-msgr-out", v[0], true)); },
    },

    sms: {
      label: "Text messages (SMS-style)",
      fields: null, thread: true,
      renderReceiver(msgs) { return phone("nt-sms", "Messages", bubbles(msgs, "nt-sms-in")); },
      renderPreview(v) { return phone("nt-sms", "Messages", bubble("nt-sms-out", v[0], true)); },
    },

    email: {
      label: "Email client",
      fields: [
        { id: "subject", label: "Subject", value: "Parents' evening", max: 80 },
        { id: "body", label: "Message", value: "Can we move my appointment to 5pm?", max: 400 },
      ],
      renderReceiver(msgs) {
        const m = msgs[0];
        const [subject, body] = splitFor("email", m.plain != null ? m.plain : m.payload);
        return mail(subject, body, m.from);
      },
      renderPreview(v) { return mail(v[0], v[1], "you"); },
    },

    login: {
      label: "Login screen",
      fields: [
        { id: "username", label: "Username", value: "a.mcleod", max: 40 },
        { id: "password", label: "Password", value: "Summer2024!", max: 40 },
      ],
      renderReceiver(msgs) {
        const m = msgs[0];
        const [user, pass] = splitFor("login", m.plain != null ? m.plain : m.payload);
        return login(user, pass, true);
      },
      renderPreview(v) { return login(v[0], v[1], false); },
    },

    banking: {
      label: "Card payment",
      warn: "Demo data only - never type a real card number.",
      fields: [
        { id: "card", label: "Card number", value: "4000 1234 5678 9010", max: 24 },
        { id: "expiry", label: "Expiry", value: "09/28", max: 7 },
        { id: "cvv", label: "Security code", value: "311", max: 4 },
      ],
      renderReceiver(msgs) {
        const m = msgs[0];
        const [card, expiry, cvv] = splitFor("banking", m.plain != null ? m.plain : m.payload);
        return card_(card, expiry, cvv, true);
      },
      renderPreview(v) { return card_(v[0], v[1], v[2], false); },
    },
  };

  // ------------------------------------------------------------ skin pieces
  function phone(cls, title, inner) {
    return `<div class="nt-phone ${cls}">
      <div class="nt-bar"><span class="nt-avatar"></span><span>${esc(title)}</span></div>
      <div class="nt-thread">${inner}</div>
    </div>`;
  }
  function bubble(cls, text, outgoing) {
    const t = String(text || "");
    if (!t) return `<div class="nt-empty">Waiting for a message...</div>`;
    return `<div class="nt-row ${outgoing ? "nt-r" : "nt-l"}">
      <div class="nt-bubble ${cls}">${esc(t)}${outgoing ? '<span class="nt-tick">&#10003;&#10003;</span>' : ""}</div>
    </div>`;
  }
  function bubbles(msgs, cls) {
    if (!msgs.length) return `<div class="nt-empty">Waiting for a message...</div>`;
    // Oldest at the top, like a real conversation.
    return msgs.slice(0, 8).reverse().map((m) => {
      const text = m.plain != null ? m.plain : m.payload;
      const t = new Date((m.at || 0) * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return `<div class="nt-row nt-l"><div class="nt-bubble ${cls}">${esc(text)}<span class="nt-time">${esc(t)}</span></div></div>`;
    }).join("");
  }
  function mail(subject, body, from) {
    return `<div class="nt-mail">
      <div class="nt-mail-head">
        <div class="nt-mail-subj">${esc(subject) || '<span class="nt-dim">(no subject)</span>'}</div>
        <div class="nt-mail-meta"><span class="nt-avatar"></span> from ${esc(from || "?")}</div>
      </div>
      <div class="nt-mail-body">${esc(body) || '<span class="nt-dim">(empty message)</span>'}</div>
    </div>`;
  }
  function login(user, pass, received) {
    const shown = String(pass || "");
    return `<div class="nt-login">
      <div class="nt-login-logo"></div>
      <div class="nt-login-title">Sign in</div>
      <label class="nt-f"><span>Username</span><div class="nt-fv">${esc(user) || "&nbsp;"}</div></label>
      <label class="nt-f"><span>Password</span><div class="nt-fv nt-pw">
        <span class="nt-dots">${"&bull;".repeat(Math.min(shown.length, 20)) || "&nbsp;"}</span>
        ${received && shown ? `<button type="button" class="nt-show" onclick="this.parentElement.querySelector('.nt-dots').outerHTML='<span class=\\'nt-dots nt-reveal\\'>' + this.dataset.p + '</span>'" data-p="${esc(shown)}">show</button>` : ""}
      </div></label>
      <div class="nt-login-btn">Sign in</div>
      ${received ? '<div class="nt-note">The app hides the password with dots. The network did not.</div>' : ""}
    </div>`;
  }
  function card_(num, expiry, cvv, received) {
    return `<div class="nt-bank">
      <div class="nt-card">
        <div class="nt-card-chip"></div>
        <div class="nt-card-num">${esc(num) || "&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull;"}</div>
        <div class="nt-card-row">
          <span><small>EXPIRES</small>${esc(expiry) || "--/--"}</span>
          <span><small>SECURITY CODE</small>${esc(cvv) || "---"}</span>
        </div>
      </div>
      <div class="nt-pay">${received ? "Payment details received" : "Pay now"}</div>
    </div>`;
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
      // Not the shape we expected - show it all in the body slot rather than
      // leaving a blank screen.
      const out = new Array(n).fill("");
      out[bodySlot(themeId)] = text;
      return out;
    }
    if (parts.length > n) {
      return parts.slice(0, n - 1).concat(parts.slice(n - 1).join(" "));
    }
    return parts;
  }
  // Where a malformed/undecryptable message is shown for each multi-field theme.
  function bodySlot(themeId) { return themeId === "email" ? 1 : 0; }

  // Multi-field text for raw/endpoint displays.
  const showJoined = (s) => String(s == null ? "" : s).split(SEP).join(" · ");
  const showRaw = (s) => String(s == null ? "" : s).split(SEP).join(SEP_SHOWN);

  // ------------------------------------------------------------ styles
  const CSS = `
.nt-dim { opacity: .55; }
.nt-plain { font-size: 5vmin; font-weight: 800; color: #cffbe9; word-break: break-word; }
.nt-empty { color: #8a94a8; padding: 22px 6px; text-align: center; }

.nt-phone {
  width: min(430px, 92%); margin: 0 auto; border-radius: 22px; overflow: hidden;
  background: #ece5dd; color: #111; box-shadow: 0 18px 50px rgba(0,0,0,.45); text-align: left;
}
.nt-bar { display: flex; align-items: center; gap: 10px; padding: 12px 14px; font-weight: 700; color: #fff; }
.nt-avatar { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,.35); flex: 0 0 26px; }
.nt-thread { padding: 14px; min-height: 180px; max-height: 42vh; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
.nt-row { display: flex; }
.nt-row.nt-l { justify-content: flex-start; }
.nt-row.nt-r { justify-content: flex-end; }
.nt-bubble {
  max-width: 78%; padding: 8px 12px; border-radius: 14px; font-size: 17px; line-height: 1.35;
  word-break: break-word; position: relative; box-shadow: 0 1px 1px rgba(0,0,0,.12);
}
.nt-time { display: block; font-size: 11px; opacity: .55; text-align: right; margin-top: 2px; }
.nt-tick { font-size: 12px; opacity: .6; margin-left: 8px; }

.nt-wa .nt-bar { background: #075e54; }
.nt-wa .nt-thread { background: #ece5dd; }
.nt-wa-in { background: #fff; }
.nt-wa-out { background: #dcf8c6; }

.nt-msgr .nt-bar { background: #0084ff; }
.nt-msgr .nt-thread { background: #fff; }
.nt-msgr-in { background: #eceff1; }
.nt-msgr-out { background: #0084ff; color: #fff; }

.nt-sms .nt-bar { background: #3b3b3d; }
.nt-sms .nt-thread { background: #fff; }
.nt-sms-in { background: #e9e9eb; }
.nt-sms-out { background: #1d8cf8; color: #fff; }

.nt-mail {
  width: min(560px, 94%); margin: 0 auto; text-align: left; background: #fff; color: #202124;
  border-radius: 14px; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,.45);
}
.nt-mail-head { padding: 16px 18px; border-bottom: 1px solid #e3e3e3; }
.nt-mail-subj { font-size: 21px; font-weight: 700; }
.nt-mail-meta { display: flex; align-items: center; gap: 8px; color: #5f6368; font-size: 14px; margin-top: 8px; }
.nt-mail-meta .nt-avatar { background: #c8d6e5; }
.nt-mail-body { padding: 18px; font-size: 17px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; min-height: 90px; }

.nt-login {
  width: min(360px, 92%); margin: 0 auto; text-align: left; background: #fff; color: #1a1a1a;
  border-radius: 16px; padding: 24px 22px; box-shadow: 0 18px 50px rgba(0,0,0,.45);
}
.nt-login-logo { width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(135deg,#4f7df1,#7b4ff1); margin-bottom: 14px; }
.nt-login-title { font-size: 22px; font-weight: 800; margin-bottom: 16px; }
.nt-f { display: block; margin-bottom: 12px; }
.nt-f span { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; margin-bottom: 4px; }
.nt-fv { border: 1px solid #d5d8dd; border-radius: 8px; padding: 10px 12px; font-size: 17px; background: #fafbfc; min-height: 42px; word-break: break-all; }
.nt-pw { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.nt-dots { letter-spacing: 3px; }
.nt-reveal { font-family: var(--mono); color: #b3261e; font-weight: 700; letter-spacing: 0; }
.nt-show { border: 1px solid #d5d8dd; background: #fff; border-radius: 6px; font-size: 12px; padding: 3px 8px; cursor: pointer; color: #444; }
.nt-login-btn { margin-top: 6px; background: #4f7df1; color: #fff; text-align: center; padding: 11px; border-radius: 8px; font-weight: 700; }
.nt-note { margin-top: 14px; font-size: 13px; color: #b3261e; }

.nt-bank { width: min(420px, 92%); margin: 0 auto; }
.nt-card {
  border-radius: 16px; padding: 22px; color: #fff; text-align: left;
  background: linear-gradient(135deg, #2b3a67, #1b2a4a 60%, #24506b);
  box-shadow: 0 18px 50px rgba(0,0,0,.45);
}
.nt-card-chip { width: 44px; height: 32px; border-radius: 6px; background: linear-gradient(135deg,#e3c46b,#b8912f); margin-bottom: 20px; }
.nt-card-num { font-family: var(--mono); font-size: 25px; letter-spacing: 2px; word-break: break-all; }
.nt-card-row { display: flex; gap: 26px; margin-top: 18px; font-family: var(--mono); font-size: 17px; }
.nt-card-row small { display: block; font-family: var(--sans); font-size: 10px; letter-spacing: .6px; opacity: .7; margin-bottom: 2px; }
.nt-pay { margin-top: 14px; background: #1f9d55; color: #fff; text-align: center; padding: 12px; border-radius: 10px; font-weight: 700; }
`;

  function injectCss() {
    if (document.getElementById("netThemeCss")) return;
    const el = document.createElement("style");
    el.id = "netThemeCss";
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  window.NetThemes = {
    SEP, SEP_SHOWN, defs, injectCss, join, splitFor, showJoined, showRaw, esc,
    list: Object.keys(defs).map((id) => ({ id, label: defs[id].label })),
    get(id) { return defs[id] || defs.classic; },
  };
})();
