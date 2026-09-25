// ClassPi OS shared helpers
(function () {
  // Esc (outside text fields) or F1 always returns to the launcher.
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (e.key === "F1" || (e.key === "Escape" && !typing && !document.querySelector(".modal.open"))) {
      if (location.pathname !== "/" && location.pathname !== "/index.html") {
        e.preventDefault();
        location.href = "/";
      }
    }
  });

  window.toast = function (msg, ms = 2200) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), ms);
  };

  window.api = async function (path, opts = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* non-JSON error */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || res.statusText || "Request failed";
      throw new Error(msg);
    }
    return data;
  };
})();
