const collapsed = document.getElementById("collapsed");
const expanded = document.getElementById("expanded");
const orbBig = document.getElementById("orb-big");
const thread = document.getElementById("thread");
const input = document.getElementById("ex-in");
const nowEl = document.getElementById("ex-now");

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ── the now card: whatever you're on, right on the orb ────────────────── */
let nowTask = null, nowTimer = null;
function fmtClock(iso) {
  if (!iso) return "0:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}
function startTimer(iso) {
  clearInterval(nowTimer);
  const tick = () => { const el = document.getElementById("ex-timer"); if (!el) { clearInterval(nowTimer); return; } el.textContent = fmtClock(iso); };
  tick(); nowTimer = setInterval(tick, 1000);
}
async function paintNow() {
  if (!nowEl) return;
  let d = null; try { d = await window.donna.tasks(); } catch {}
  clearInterval(nowTimer);
  if (!d) { nowEl.innerHTML = ""; return; }
  const doing = d.open.find((t) => t.status === "doing");
  const top = doing || d.open.slice().sort((a, b) => a.priority - b.priority)[0];
  nowTask = top || null;
  if (!top) { nowEl.innerHTML = `<div class="ex-now-k">Nothing open</div><div class="ex-now-t" style="color:var(--dim)">You're clear — capture below.</div>`; return; }
  nowEl.innerHTML = `
    <div class="ex-now-top"><span class="ex-now-k">${doing ? "In focus" : "Up next"}</span>
      ${doing ? `<span class="ex-timer" id="ex-timer">${fmtClock(doing.startedAt)}</span>` : ""}
      <span class="ex-pri p${top.priority}">P${top.priority}</span></div>
    <div class="ex-now-t">${esc(top.title)}</div>
    <div class="ex-now-acts">
      <button class="ex-now-btn" id="ex-toggle">${doing ? "❚❚ Pause" : "▶ Start"}</button>
      <button class="ex-now-btn primary" id="ex-done">✓ Done</button>
    </div>`;
  const toggle = document.getElementById("ex-toggle");
  if (toggle) toggle.onclick = async () => { try { await window.donna.setStatus(top.id, doing ? "todo" : "doing"); } catch {} paintNow(); };
  const done = document.getElementById("ex-done");
  if (done) done.onclick = async () => { try { await window.donna.completeTask(top.id); } catch {} paintNow(); };
  if (doing) startTimer(doing.startedAt);
}

/* ── rotating suggestions (same grammar as the Ask hub, scaled down) ───── */
const ORB_SUGGESTIONS = [
  "What should I hit first today?",
  "best: draft a sharp opening line for a message",
  "What should I NOT touch today?",
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
function startSug() { clearInterval(sugTimer); sugTimer = setInterval(() => { sugIdx++; paintSugg(); }, 5000); }
function ensureSuggestions() {
  if (thread.querySelector(".msg")) return;
  if (!thread.querySelector(".ex-empty")) {
    thread.innerHTML = `<div class="ex-empty"><span>Ask me anything — I'll answer right here.</span><button class="ex-sugg" id="ex-sugg"></button></div>`;
    document.getElementById("ex-sugg").onclick = () => { const q = document.getElementById("ex-sugg").dataset.q; if (q) runAsk(q); };
  }
  paintSugg(); startSug();
}

function setExpanded(on) {
  collapsed.classList.toggle("hidden", on);
  expanded.classList.toggle("on", on);
  try { window.donna.orbSetExpanded(on); } catch {}
  if (on) { paintNow(); ensureSuggestions(); setTimeout(() => input && input.focus(), 80); }
  else { clearInterval(sugTimer); sugTimer = null; }
}

document.getElementById("orb-click").onclick = () => setExpanded(true);
document.getElementById("ex-collapse").onclick = () => setExpanded(false);
document.getElementById("ex-open").onclick = () => { try { window.donna.showMain(); } catch {} setExpanded(false); };
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
  paintNow();
});

async function runAsk(q) {
  clearInterval(sugTimer);
  addMsg(q.replace(/^(best|think|quick):\s*/i, ""), "me");
  curBot = null;
  const tagged = orbMode ? `${orbMode}: ${q.replace(/^(best|think|quick):\s*/i, "")}` : q;
  try { await window.donna.ask(tagged); } catch { addMsg("Couldn't reach the brain — try again.", "her"); }
  paintNow();
}

input.onkeydown = (e) => {
  if (e.key !== "Enter" || !input.value.trim()) return;
  const q = input.value.trim();
  input.value = "";
  runAsk(q);
};

paintNow();
