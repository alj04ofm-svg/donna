const collapsed = document.getElementById("collapsed");
const expanded = document.getElementById("expanded");
const orbBig = document.getElementById("orb-big");
const thread = document.getElementById("thread");
const input = document.getElementById("ex-in");

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function setExpanded(on) {
  collapsed.classList.toggle("hidden", on);
  expanded.classList.toggle("on", on);
  window.donna.orbSetExpanded(on);
  if (on) setTimeout(() => input.focus(), 80);
}

document.getElementById("orb-click").onclick = () => setExpanded(true);
document.getElementById("ex-collapse").onclick = () => setExpanded(false);

/* same mode buttons + rotating suggestions as the full Ask hub, scaled down —
   the orb is a mini version of the same "our own AI" experience, not a
   stripped-down afterthought. */
const ORB_SUGGESTIONS = [
  "What should I hit first today?",
  "best: a punchy World Cup reel opener",
  "What's blocking the pipeline right now?",
  "Plan my next 2 hours",
  "What shipped today?",
  "think: what's my highest-leverage move this week?",
];
let orbMode = null, sugIdx = 0, sugTimer = null;
function paintSugg() {
  const el = document.getElementById("ex-sugg"); if (!el) return;
  sugIdx = sugIdx % ORB_SUGGESTIONS.length;
  el.textContent = ORB_SUGGESTIONS[sugIdx].replace(/^(best|think|quick):\s*/, "");
  el.dataset.q = ORB_SUGGESTIONS[sugIdx];
}
document.getElementById("ex-sugg").onclick = () => { const q = document.getElementById("ex-sugg").dataset.q; if (q) runAsk(q); };
paintSugg();
sugTimer = setInterval(() => { sugIdx++; paintSugg(); }, 5000);
document.querySelectorAll(".ex-mode").forEach((b) => (b.onclick = () => {
  orbMode = orbMode === b.dataset.mode ? null : b.dataset.mode;
  document.querySelectorAll(".ex-mode").forEach((x) => x.classList.toggle("on", x.dataset.mode === orbMode));
}));

function addMsg(text, who) {
  const empty = thread.querySelector(".ex-empty"); if (empty) empty.remove();
  const d = document.createElement("div");
  d.className = `msg ${who}`;
  d.textContent = text;
  thread.appendChild(d);
  thread.scrollTop = thread.scrollHeight;
  return d;
}

let curBot = null;
window.donna.onToken((t) => {
  if (!curBot) curBot = addMsg("", "her");
  curBot.textContent += t;
  thread.scrollTop = thread.scrollHeight;
});
window.donna.onState((s) => {
  orbBig.classList.toggle("thinking", s === "thinking");
  orbBig.classList.toggle("speaking", s === "speaking");
});

/* wake word — main already forced the window into expanded bounds and is
   running the ask itself; here we just reflect that state and show what she
   heard. Do NOT call runAsk — that would double-fire the brain. */
window.donna.onWake((q) => {
  collapsed.classList.add("hidden");
  expanded.classList.add("on");
  clearInterval(sugTimer);
  addMsg(q, "me");
  curBot = null;
});

async function runAsk(q) {
  clearInterval(sugTimer);
  addMsg(q.replace(/^(best|think|quick):\s*/i, ""), "me");
  curBot = null;
  const tagged = orbMode ? `${orbMode}: ${q.replace(/^(best|think|quick):\s*/i, "")}` : q;
  try { await window.donna.ask(tagged); } catch { addMsg("Couldn't reach the brain — try again.", "her"); }
}

input.onkeydown = (e) => {
  if (e.key !== "Enter" || !input.value.trim()) return;
  const q = input.value.trim();
  input.value = "";
  runAsk(q);
};
