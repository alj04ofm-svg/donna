/* polish.js — the runtime half of the polish layer. CSS can't know a child's
   index for staggered entrances or mark which bars to reveal, so we do it here
   in one mutation-driven pass over #main. Safe before the shell boots and
   respects prefers-reduced-motion. */
(function () {
  "use strict";
  const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

  const STAGGER = [
    ".goal-list > .goal2", ".note-list > .note-card", ".idea-list > .idea-card",
    ".notes-rows > .notes-row", ".pl-week > .pl-wcol", ".pl-unsched > .pl-wcard",
    ".tk-board > .tk-cell", ".tt-body > .tt-row", ".t2-upnext > .t2-up",
    ".t2-timeline > .t2-block", ".board > .col", ".cyc-cov-row", ".tk-cats > .tk-cat",
    ".cap-stream > .cap-row", ".set-group", ".ask-jgroup",
  ];
  const BARS = [
    ".kr-fill", ".cyc-bar-fill", ".week-fill", ".cap-fill", ".lead-fill",
    ".tk-cat-bar > div", ".cyc-cov-bar > div", ".cr-fill", ".t2-bar-past",
    ".tk-cat-bar div", ".bar-fill", ".prog-fill",
  ];
  const COUNTS = [".tk-cell > b", ".pl-cell > b", ".cyc-score-n > span", ".cyc-cov-n", ".tk-cat-m"];

  /* count a plainly-numeric stat up from zero — only pure digits (+ optional
     %), never multi-part strings like "2h 30m" */
  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const m = el.textContent.trim().match(/^(\d+(?:\.\d+)?)(%?)$/);
    if (!m) return;
    const target = parseFloat(m[1]); const dec = m[1].includes(".") ? 1 : 0;
    const dur = 550, start = performance.now();
    const frame = (t) => {
      const p = Math.min(1, (t - start) / dur);
      el.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(dec) + m[2];
      if (p < 1) requestAnimationFrame(frame); else el.textContent = target.toFixed(dec) + m[2];
    };
    requestAnimationFrame(frame);
  }

  function dress(root) {
    if (!root || reduced()) return;
    for (const sel of STAGGER) {
      root.querySelectorAll(sel).forEach((el, i) => {
        if (!el.style.getPropertyValue("--i")) el.style.setProperty("--i", String(Math.min(i, 16)));
      });
    }
    for (const sel of BARS) root.querySelectorAll(sel).forEach((el) => el.classList.add("bar-anim"));
    for (const sel of COUNTS) root.querySelectorAll(sel).forEach(countUp);
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; dress(document.getElementById("main")); });
  }

  function start() {
    const main = document.getElementById("main");
    if (!main) { requestAnimationFrame(start); return; }
    dress(main);
    new MutationObserver(schedule).observe(main, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
