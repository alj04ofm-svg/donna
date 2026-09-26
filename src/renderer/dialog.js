/* dialog.js — one controller for every overlay. The app grew several modal
   shapes (.sd-panel prompts, the task composer's .tk-panel, triage, briefing…);
   this gives them all the same behavior without touching each one: role/aria,
   Escape to dismiss (via their own close button or backdrop), a Tab focus trap,
   and focus restoration when they close. */
(function () {
  "use strict";
  const PANEL = ".sd-panel, .tk-panel";

  function overlays() {
    return [...document.querySelectorAll(PANEL)]
      .filter((p) => p.offsetParent !== null || p.getClientRects().length)
      .map((p) => p.closest("#task-detail-ov, #prompt-modal, #wkc-modal, #brief-modal") || p.parentElement)
      .filter(Boolean);
  }
  const topPanel = () => {
    const list = [...document.querySelectorAll(PANEL)];
    return list.length ? list[list.length - 1] : null;
  };
  const topOverlay = () => {
    const all = overlays();
    return all.length ? all[all.length - 1] : null;
  };

  /* aria + focus bookkeeping on every panel that appears, restore on removal */
  let lastFocus = null;
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes && m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches(PANEL)) { n.setAttribute("role", "dialog"); n.setAttribute("aria-modal", "true"); if (!lastFocus) lastFocus = document.activeElement; }
        else if (n.querySelector && n.querySelector(PANEL)) { if (!lastFocus) lastFocus = document.activeElement; n.querySelectorAll(PANEL).forEach((p) => { p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); }); }
      });
      m.removedNodes && m.removedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        const hadPanel = (n.matches && n.matches(PANEL)) || (n.querySelector && n.querySelector(PANEL));
        if (!hadPanel) return;
        if (!document.querySelector(PANEL)) {
          const f = lastFocus; lastFocus = null;
          if (f && document.body.contains(f)) { try { f.focus(); } catch {} }
        }
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  /* Escape → dismiss the topmost dialog, preferring its own close affordance
     so promise-based modals resolve exactly as if the user clicked Cancel. */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const panel = topPanel();
    if (!panel) return;
    const overlay = topOverlay();
    e.preventDefault();
    e.stopPropagation();
    const btn = panel.querySelector("#td-close, #tri-close, #brief-close, .pm-cancel, .sd-close, [data-close]");
    if (btn) { btn.click(); return; }
    if (overlay && overlay.onclick) { overlay.dispatchEvent(new MouseEvent("click", { bubbles: true })); return; }
    if (overlay) overlay.remove();
  }, true);

  /* Tab focus trap within the topmost dialog */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const panel = topPanel();
    if (!panel) return;
    const f = [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, true);
})();
