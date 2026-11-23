// Lightweight notification helper for authentication pages.
// The dashboard provides the richer version from app.js; auth pages only need
// a safe success/error notification before redirecting.
window.sdgNotify = window.sdgNotify || async function (message, options = {}) {
  const text = String(message ?? "");
  const root = document.createElement("div");
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-modal", "true");
  root.style.cssText = "position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:rgba(15,23,42,.45);padding:1rem;";
  root.innerHTML = `
    <div style="width:min(100%,420px);background:#fff;border-radius:18px;padding:1.5rem;box-shadow:0 20px 60px rgba(15,23,42,.24);">
      <h5 style="margin:0 0 .65rem;font-weight:700;">${options.title || "Information"}</h5>
      <p style="white-space:pre-line;color:#64748b;margin:0 0 1.25rem;">${text.replace(/[&<>]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]))}</p>
      <button type="button" class="btn btn-success w-100">${options.actionText || "Continue"}</button>
    </div>`;
  document.body.appendChild(root);
  return new Promise(resolve => {
    const close = () => { root.remove(); resolve(); };
    root.querySelector("button").addEventListener("click", close, { once: true });
    window.setTimeout(close, options.duration || 4000);
  });
};
