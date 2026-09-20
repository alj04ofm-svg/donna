/* motion.js — Donna's shared physics. One motion system so everything feels
   like one hand built it: spring curves live in CSS custom properties
   (--spring-pop etc. in app.css), FLIP makes reorders physical, and particle
   bursts are reserved for *earned* moments (selective emphasis — a burst on
   every row would make none of them mean anything). Everything here respects
   prefers-reduced-motion. */

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* FLIP — record → mutate → invert → play. Pass the container, a mutate() that
   re-renders it, and (optionally) the selector whose data-id keys identity.
   Elements that existed before and after glide; new ones just appear. */
function flipList(container, mutate, selector = "[data-id]") {
  if (reducedMotion() || !container) { mutate(); return; }
  const before = new Map();
  container.querySelectorAll(selector).forEach((el) => before.set(el.dataset.id, el.getBoundingClientRect()));
  mutate();
  container.querySelectorAll(selector).forEach((el) => {
    const b = before.get(el.dataset.id);
    if (!b) return;
    const a = el.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top;
    if (!dx && !dy) return;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
      { duration: 240, easing: "cubic-bezier(.22,1,.36,1)" }
    );
  });
}

/* Particle burst at a point — 12-18 tiny dots on random vectors, WAAPI-driven,
   self-cleaning. hue matches the moment (250 work-violet, 160 health-green…). */
function burst(x, y, { n = 14, hue = 250, dist = 64 } = {}) {
  if (reducedMotion()) return;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.className = "pt";
    p.style.left = x + "px"; p.style.top = y + "px";
    p.style.background = `hsl(${hue + (Math.random() * 40 - 20)} 85% ${60 + Math.random() * 15}%)`;
    document.body.appendChild(p);
    const ang = Math.random() * Math.PI * 2;
    const d = dist * (0.45 + Math.random() * 0.55);
    const dx = Math.cos(ang) * d, dy = Math.sin(ang) * d - d * 0.25; // slight upward drift
    p.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${0.2 + Math.random() * 0.4})`, opacity: 0 },
      ],
      { duration: 480 + Math.random() * 220, easing: "cubic-bezier(.16,.84,.44,1)" }
    ).onfinish = () => p.remove();
  }
}
const burstFrom = (el, opts) => {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
};
