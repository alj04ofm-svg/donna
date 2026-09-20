/* Donna renderer — three window modes, live local data, Linear-grade keyboard,
   Kanban board, streaming Ask. Vanilla JS, one keydown state machine. */

window.__ver = "1.0";
const $ = (s) => document.querySelector(s);
const main = $("#main");
let view = "today";
let taskLayout = localStorage.getItem("donna.taskLayout") || "list";
let data = null;    // tasks summary
let prod = null;    // production snapshot (+agents)
let cfg = {};       // config.json
let habitsCache = []; // today's routines
let replacementsCache = []; // habit-replacement loops (Power of Habit)
let searchCache = []; // flat index of everything, for ⌘K global search
let remindersCache = []; // pending reminders, surfaced on Today
const thread = [];
let streaming = false;
let cur = -1;       // keyboard cursor index into curList
let curList = [];   // ordered visible open tasks (list contexts)
const askHistory = JSON.parse(localStorage.getItem("donna.askHistory") || "[]");
let histIdx = -1;

/* ── sections — every page + strip is a toggle. Consulted at render time.
   Call applySections() AFTER every render to hide off sections. Listens
   for the donna:sections custom event so Settings flips are live. */
function applySections() {
  try {
    document.querySelectorAll("[data-section]").forEach((el) => {
      el.style.display = window.sections.isOn(el.dataset.section) ? "" : "none";
    });
    document.querySelectorAll("[data-strip]").forEach((el) => {
      el.style.display = window.sections.isOn(el.dataset.strip) ? "" : "none";
    });
  } catch {}
}
window.addEventListener("donna:sections", () => { try { applySections(); } catch {} });

/* ── helpers ── */
const esc = (s) => (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const trunc = (s, n) => ((s || "").length > n ? s.slice(0, n) + "…" : (s || ""));

/* project tracks → colored tags (Alex's real work streams) */
const PROJECTS = {
  proj_worldcup_30: { label: "World Cup", hue: 28 },
  proj_gossip_finish: { label: "Gossip", hue: 330 },
  proj_today: { label: "Today", hue: 250 },
  proj_secondary: { label: "Ops", hue: 200 },
};
const projMeta = (id) => PROJECTS[id] || (id ? { label: id.replace(/^proj_/, "").replace(/_/g, " "), hue: 240 } : null);
function projChip(t) { const p = projMeta(t.project_id); return p ? `<span class="proj-chip" style="--h:${p.hue}">${esc(p.label)}</span>` : ""; }
function estChip(t) { return t.estimatedMinutes ? `<span class="chip est">${t.estimatedMinutes >= 60 ? (t.estimatedMinutes / 60).toFixed(t.estimatedMinutes % 60 ? 1 : 0) + "h" : t.estimatedMinutes + "m"}</span>` : ""; }
function recurChip(t) { return t.recurrence ? `<span class="chip recur" title="Repeats ${t.recurrence.freq}">↻ ${t.recurrence.freq === "weekdays" ? "weekdays" : t.recurrence.freq}</span>` : ""; }
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const CHECK_SVG = '<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6.5"/></svg>';
const MOON_SVG = '<svg viewBox="0 0 16 16"><path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z"/></svg>';
let stagger = 0;
const si = () => ` style="--i:${stagger++}"`;
const pGlyph = (p) => `<span class="pglyph g${p}" title="P${p}"><i></i><i></i><i></i></span>`;

function dueChip(d) {
  if (!d) return "";
  const days = Math.ceil((new Date(d) - new Date()) / 86400000);
  const cls = days < 0 ? "soon" : days <= 1 ? "soon" : "";
  const txt = days < 0 ? "overdue" : days === 0 ? "today" : days === 1 ? "tomorrow" : d.slice(5);
  return `<span class="chip due ${cls}">${txt}</span>`;
}
/* chip budget = max ONE status chip per row (+ the priority glyph). precedence:
   now > deadline-at-risk > overdue/soon-due > waiting. keeps rows calm. */
function statusChip(t) {
  if (t.status === "doing") return `<span class="chip now-chip" data-started="${t.startedAt}" data-prefix="◷ ">◷ ${elapsed(t.startedAt)}</span>`;
  const dl = deadlineChip(t);
  if (dl) return dl;
  if (t.dueAt) { const days = Math.ceil((new Date(t.dueAt) - new Date()) / 86400000); if (days <= 1) return dueChip(t.dueAt); }
  if (t.waitingOn) return `<span class="chip wait">${esc(t.waitingOn)}</span>`;
  return "";
}

/* the DEADLINE is the drop-dead date (Things' red flag), separate from the
   when-date. Counts down, goes hot inside 2 days, screams when missed. */
function deadlineChip(t) {
  if (!t.deadline) return "";
  const days = Math.ceil((new Date(t.deadline) - new Date()) / 86400000);
  const cls = days < 0 ? "missed" : days <= 2 ? "hot" : "";
  const txt = days < 0 ? "past deadline" : days === 0 ? "deadline today" : `⚑ ${days}d`;
  return `<span class="chip deadline ${cls}" title="deadline ${t.deadline}${t.deadlineHard ? " · hard" : ""}">${txt}</span>`;
}

async function refresh() { data = await window.donna.tasks(); paintChrome(); return data; }
async function refreshProd() { prod = await window.donna.production(); paintChrome(); return prod; }

function paintChrome() {
  if (!data) return;
  const { counts } = data;
  const setText = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
  setText("#count-tasks", counts.open || "");
  const momentum = counts.doneToday ? ` · ${counts.doneToday} done today` : "";
  setText("#foot-status", `${counts.open} open · ${counts.p1} P1${momentum}`);
  setText("#c-counts", `${counts.p1} P1 · ${counts.open} open`);
  // pill = ONE thing: the task you're ON (with live timer), else the top focus task
  const doing = data.open.find((t) => t.status === "doing");
  const top = doing || data.open.slice().sort((a, b) => a.priority - b.priority)[0];
  $("#pill-text").textContent = top ? (doing ? `▸ ${top.title}  ·  ${elapsed(top.startedAt)}` : top.title) : "Clear — nothing open";
}

/* ── task rows ── */
/* focus-session clock — mm:ss (or h:mm past an hour), ticks live */
function elapsed(startedAt) {
  if (!startedAt) return "0:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt)) / 1000));
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h > 0 ? `${h}:${String(m % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
}
/* update every live timer element + the pill, once a second while a session runs */
function tickTimers() {
  document.querySelectorAll("[data-started]").forEach((el) => {
    el.textContent = (el.dataset.prefix || "") + elapsed(el.dataset.started);
  });
  const pt = $("#pill-text");
  if (pt) { const d = data && data.open.find((t) => t.status === "doing"); if (d) pt.textContent = `▸ ${d.title}  ·  ${elapsed(d.startedAt)}`; }
}

function rowHtml(t, { compact = false, idx = -1 } = {}) {
  const doing = t.status === "doing";
  if (compact) {
    return `<div class="c-row ${doing ? "now" : ""}" data-id="${t.id}">
      <button class="check" data-done="${t.id}">${CHECK_SVG}</button>
      <span class="c-row-title">${esc(t.title)}</span>${doing ? `<span class="chip now-chip">now</span>` : pGlyph(t.priority)}</div>`;
  }
  return `<div class="row ${idx === cur ? "cur" : ""} ${doing ? "now" : ""} ${t.detail ? "has-detail" : ""}" data-id="${t.id}" data-idx="${idx}"${si()}>
    <button class="check" data-done="${t.id}" aria-label="Mark done">${CHECK_SVG}</button>
    <div class="row-body">
      <div class="row-title" data-expand>${esc(t.title)}${t.detail ? '<svg class="row-caret" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4"/></svg>' : ""}</div>
      ${t.detail ? `<div class="row-detail">${esc(t.detail)}</div>` : ""}
    </div>
    <div class="row-meta">
      ${projChip(t)}${estChip(t)}${recurChip(t)}
      <div class="row-acts">
        <button class="icon-btn" data-start="${t.id}" title="${doing ? "Stop (D)" : "Start now (D)"}">
          ${doing ? '<svg viewBox="0 0 16 16"><rect x="4.5" y="4.5" width="7" height="7" rx="1.5"/></svg>'
                  : '<svg viewBox="0 0 16 16"><path d="M5.5 3.5l7 4.5-7 4.5z"/></svg>'}</button>
        <button class="icon-btn" data-wait="${t.id}" title="Waiting on someone (W)"><svg viewBox="0 0 16 16"><circle cx="8" cy="5.5" r="2.6"/><path d="M3.2 13c.8-2.5 2.6-3.8 4.8-3.8s4 1.3 4.8 3.8"/></svg></button>
        <button class="icon-btn" data-snooze="${t.id}" title="Reschedule (S)"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.8"/><path d="M8 5v3.2l2 1.6"/></svg></button>
      </div>
      ${statusChip(t)}${pGlyph(t.priority)}
    </div>
  </div>`;
}

/* No external pipeline in the public build. */
function opLine() {
  return "";
}
function wireOpLine(scope) { const el = scope.querySelector(".op-line"); if (el) el.onclick = () => gotoView(el.dataset.goto); }

/* progressive disclosure — collapsed section that expands on click */
function disclosure(key, label, count, inner) {
  return `<div class="disc collapsed" data-disc="${key}">
    <button class="disc-head"><svg class="disc-caret" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4"/></svg>${label}<span class="disc-n">${count}</span></button>
    <div class="disc-body">${inner}</div>
  </div>`;
}
function wireDisclosures(scope) {
  scope.querySelectorAll(".disc-head").forEach((h) => (h.onclick = () => h.closest(".disc").classList.toggle("collapsed")));
}

/* completion: strike → beat → collapse (the reward loop) */
async function completeWithAnim(id, rowEl) {
  const check = rowEl?.querySelector(".check");
  if (check) check.classList.add("on");
  if (rowEl) rowEl.classList.add("striking");
  try { snd.tick(); burstFrom(check, { n: 10, dist: 42 }); } catch {}
  await new Promise((r) => setTimeout(r, 420)); // see it get checked
  if (rowEl) rowEl.classList.add("done-anim");
  await window.donna.completeTask(id);
  setTimeout(async () => { await refresh(); render(); renderCompactBody(); }, 260);
  toast("Done");
}

function wireRows(scope) {
  scope.querySelectorAll("[data-done]").forEach((el) => (el.onclick = (e) => {
    e.stopPropagation();
    completeWithAnim(el.dataset.done, el.closest(".row, .c-row"));
  }));
  scope.querySelectorAll("[data-expand]").forEach((el) => (el.onclick = () => el.closest(".row").classList.toggle("open")));
  scope.querySelectorAll("[data-snooze]").forEach((el) => (el.onclick = (e) => {
    e.stopPropagation();
    openSnooze(el.dataset.snooze, el.getBoundingClientRect());
  }));
  scope.querySelectorAll("[data-start]").forEach((el) => (el.onclick = async (e) => {
    e.stopPropagation();
    const t = (data.open || []).find((x) => x.id === el.dataset.start);
    await window.donna.setStatus(el.dataset.start, t?.status === "doing" ? "todo" : "doing");
    await refresh(); render(); renderCompactBody();
    toast(t?.status === "doing" ? "Paused" : "On it");
  }));
  scope.querySelectorAll("[data-wait]").forEach((el) => (el.onclick = (e) => {
    e.stopPropagation();
    openWaitPop(el.dataset.wait, el.getBoundingClientRect());
  }));
  scope.querySelectorAll(".row[data-idx]").forEach((el) => (el.onmouseenter = () => { cur = Number(el.dataset.idx); paintCursor(); }));
}

function paintCursor() {
  document.querySelectorAll(".row[data-idx]").forEach((el) => el.classList.toggle("cur", Number(el.dataset.idx) === cur));
  const el = document.querySelector(`.row[data-idx="${cur}"]`);
  if (el) el.scrollIntoView({ block: "nearest" });
}

/* snooze / when popover (Things' quick reschedule) */
let popEl = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
function openSnooze(id, anchor) {
  closePop();
  const iso = (d) => d.toISOString().slice(0, 10);
  const t = new Date(); const tom = new Date(t); tom.setDate(t.getDate() + 1);
  const mon = new Date(t); mon.setDate(t.getDate() + ((8 - t.getDay()) % 7 || 7));
  const opts = [
    ["Today", iso(t)], ["Tomorrow", iso(tom)], ["Next week", iso(mon)], ["No date", null],
  ];
  popEl = document.createElement("div");
  popEl.className = "pop";
  popEl.innerHTML = opts.map(([l, v]) => `<button data-due="${v ?? ""}">${l}<span>${v ? v.slice(5) : ""}</span></button>`).join("")
    + `<button data-someday="1">Someday<span>parked</span></button>`
    + `<button data-wontdo="1" class="pop-danger">Won't do<span>let it go</span></button>`;
  document.body.appendChild(popEl);
  const r = popEl.getBoundingClientRect();
  popEl.style.left = Math.min(anchor.left, window.innerWidth - r.width - 12) + "px";
  popEl.style.top = Math.min(anchor.bottom + 6, window.innerHeight - r.height - 12) + "px";
  popEl.querySelectorAll("button[data-due]").forEach((b) => (b.onclick = async () => {
    await window.donna.setDue(id, b.dataset.due || null);
    closePop(); await refresh(); render(); toast("Rescheduled");
  }));
  popEl.querySelector("[data-someday]").onclick = async () => {
    await window.donna.setTaskField(id, "bucket", "someday");
    await window.donna.setDue(id, null);
    closePop(); await refresh(); render(); toast("Parked in Someday");
  };
  popEl.querySelector("[data-wontdo]").onclick = async () => {
    const reason = prompt("Won't do — one honest line why (optional):", "");
    if (reason === null) return;
    await window.donna.setWontDo(id, reason);
    closePop(); await refresh(); render(); toast("Let go. Honest beats guilty.");
  };
  setTimeout(() => document.addEventListener("mousedown", function h(e) {
    if (popEl && !popEl.contains(e.target)) closePop();
    document.removeEventListener("mousedown", h);
  }), 0);
}

function openWaitPop(id, anchor) {
  closePop();
  const t = (data.open || []).find((x) => x.id === id);
  const people = ["george", "biss", "va", "p1"];
  popEl = document.createElement("div");
  popEl.className = "pop";
  popEl.innerHTML = (t?.waitingOn ? `<button data-who="">Clear waiting<span>${esc(t.waitingOn)}</span></button>` : "")
    + people.map((p) => `<button data-who="${p}">Waiting on ${p}</button>`).join("");
  document.body.appendChild(popEl);
  const r = popEl.getBoundingClientRect();
  popEl.style.left = Math.min(anchor.left, window.innerWidth - r.width - 12) + "px";
  popEl.style.top = Math.min(anchor.bottom + 6, window.innerHeight - r.height - 12) + "px";
  popEl.querySelectorAll("button").forEach((b) => (b.onclick = async () => {
    await window.donna.setWaiting(id, b.dataset.who || null);
    closePop(); await refresh(); render();
    toast(b.dataset.who ? `Waiting on ${b.dataset.who}` : "Back on you");
  }));
  setTimeout(() => document.addEventListener("mousedown", function h(e) {
    if (popEl && !popEl.contains(e.target)) closePop();
    document.removeEventListener("mousedown", h);
  }), 0);
}

/* ── right-rail panels ── */
function pipelinePanel() {
  if (!prod) return "";
  return `<div class="panel"${si()}>
    <div class="panel-head">Pipeline <span class="panel-sub">live</span></div>
    ${prod.stages.map((s) => `
      <div class="pl-row ${s.alert ? "alert" : ""}">
        <span class="pl-n">${s.n}</span>
        <span class="pl-body"><span class="pl-label">${s.label}</span>
        <span class="pl-detail">${esc(s.detail)}</span></span>
      </div>`).join("")}
  </div>`;
}
function agentsPanel() {
  if (!prod?.agents?.length) return "";
  return `<div class="panel"${si()}>
    <div class="panel-head">Agents <span class="panel-sub">herdr</span></div>
    ${prod.agents.map((a) => `
      <div class="ag-row"><span class="ag-dot ${a.status}"></span>
      <span class="ag-name">${esc(a.name)}</span>
      <span class="ag-status">${esc(a.status)}</span></div>`).join("")}
  </div>`;
}
function postPanel() {
  if (!prod?.accounts?.length) return "";
  return `<div class="panel"${si()}>
    <div class="panel-head">Post-ready <span class="panel-sub">${prod.stages.find((s) => s.key === "post")?.n || 0} reels</span></div>
    ${prod.accounts.slice(0, 5).map((a) => `
      <div class="ag-row"><span class="ag-name">${esc(a.account)}</span>
      <span class="pl-n" style="font-size:12px">${a.count}</span></div>`).join("")}
  </div>`;
}

/* capacity meter (Sunsama honesty bar) — only when estimates exist */
function capacityMeter() {
  const est = data.open.filter((t) => t.estimatedMinutes);
  if (!est.length) return "";
  const mins = est.reduce((n, t) => n + t.estimatedMinutes, 0);
  const cap = (cfg.capacityHours || 6) * 60;
  const pct = Math.min(100, Math.round((mins / cap) * 100));
  const cls = pct > 100 ? "over" : pct > 75 ? "warn" : "";
  return `<div class="cap-meter"><span>${Math.round(mins / 60 * 10) / 10}h planned</span>
    <div class="cap-track"><div class="cap-fill ${cls}" style="width:${pct}%"></div></div><span>6h cap</span></div>`;
}

/* ── live NL token highlighting (Todoist × Dot's green flash) ──
   A mirror div floats over the input: transparent text, translucent marks
   under the exact characters the grammar grabbed, plus a chips row showing
   what parsed. Same tokenizer as main (nlparse.js) — marks never lie. */
function enhanceCapture(inp) {
  if (!inp || inp.__nl || typeof nlTokenize === "undefined") return;
  inp.__nl = true;
  const wrap = inp.parentElement;
  wrap.classList.add("qa-wrap");
  const mirror = document.createElement("div");
  mirror.className = "qa-mirror";
  const cs = getComputedStyle(inp);
  mirror.style.padding = cs.padding;
  mirror.style.font = cs.font;
  mirror.style.borderWidth = cs.borderWidth;
  mirror.style.height = inp.offsetHeight ? inp.offsetHeight + "px" : "auto";
  wrap.insertBefore(mirror, inp.nextSibling);
  const chips = document.createElement("div");
  chips.className = "qa-chips";
  chips.hidden = true;
  wrap.appendChild(chips);
  const paint = () => {
    const v = inp.value;
    if (!mirror.style.height || mirror.style.height === "auto") { if (inp.offsetHeight) mirror.style.height = inp.offsetHeight + "px"; }
    if (!v.trim()) { mirror.innerHTML = ""; chips.hidden = true; return; }
    const { tokens, labels } = nlTokenize(v);
    let html = "", pos = 0;
    for (const t of tokens) {
      html += esc(v.slice(pos, t.i0)) + `<mark class="tk-${t.kind}">${esc(v.slice(t.i0, t.i1))}</mark>`;
      pos = t.i1;
    }
    mirror.innerHTML = html + esc(v.slice(pos));
    mirror.scrollLeft = inp.scrollLeft;
    if (labels.length) {
      chips.hidden = false;
      chips.innerHTML = `<span class="qa-parsed">↳</span>`
        + labels.map((l) => `<span class="qa-chip tk-${l.kind}">${esc(l.label)}</span>`).join("")
        + `<span class="qa-esc">"quotes" keep words literal</span>`;
    } else chips.hidden = true;
  };
  inp.addEventListener("input", paint);
  inp.addEventListener("scroll", () => (mirror.scrollLeft = inp.scrollLeft));
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") setTimeout(paint, 60); });
}

/* ── AI COACH ────────────────────────────────────────────────────────────────
   A contextual ✦ button that floats top-right of every page. Click it to get
   2 preset suggestions + a free-text "ask anything about this page" input.
   Both routes use `window.donna.askInternal` (cheap M3, not the heavy Ask
   brain), so the cost is one quick call per click — no streaming, no mining.

   Mounting pattern: each view function calls openCoachButton(page, ctx) at
   the end of its render. The helper rides into the .view container and is
   cleaned up the next time the page rerenders (or the view switches).

   Page key (first arg) just records which suggestion chips render. The real
   data lives in `ctx` — whatever's meaningful to share. We cap the JSON size
   (small subsets, not the entire datasets) to keep prompt tokens low. */
const COACH_TIPS = {
  today: [
    "what should I do first?",
    "what's slipping this week?",
  ],
  tasks: [
    "which tasks should I re-prioritize?",
    "draft a plan for the 3 oldest",
  ],
  goals: [
    "where am I stuck?",
    "draft a 12-week plan for my top goal",
  ],
  activity: [
    "what was my biggest win this week?",
    "summarize my last 7 days",
  ],
  people: [
    "who needs attention",
    "draft a check-in for the most drifting person",
  ],
  library: [
    "organize my notes",
    "draft an idea from my recent captures",
  ],
  memory: [
    "what do you know about me?",
    "what's a fact worth double-checking?",
  ],
  life: [
    "where do I keep skipping?",
    "draft a vision for an empty area",
  ],
  production: [
    "what's blocking the pipeline?",
    "next reel to ship",
  ],
  plan: [
    "replan around now",
    "what should I drop to fit?",
  ],
  settings: [
    "what would you optimize?",
    "explain the section toggles",
  ],
  comms: [
    "what needs a reply right now?",
    "draft a follow-up to my last email",
  ],
  /* Ask is special: the entire page IS the AI hub, so the suggestion chips
     would just duplicate the rail. We still drop a coach button that
     opens a quick "jump to thread" — plus the same free-text input. */
  ask: [
    "summarize our last chat",
    "what were we talking about?",
  ],
};

function closeCoach() {
  document.querySelector(".coach-pop")?.remove();
  document.querySelector(".coach-btn")?.classList.remove("open");
}

function openCoachButton(page, ctx) {
  if (!window.sections.isOn("ai.coach")) return;
  /* cleanup any prior mount — re-render must not stack buttons */
  document.querySelector(".coach-btn")?.remove();
  document.querySelector(".coach-pop")?.remove();

  const view = main.querySelector(".view") || main;
  if (!view.style.position) view.style.position = "relative";

  const btn = document.createElement("button");
  btn.className = "coach-btn";
  btn.title = `AI coach · ${page}`;
  btn.innerHTML = `<span class="coach-orb">✦</span><span class="coach-label">coach</span>`;
  view.appendChild(btn);

  const pop = document.createElement("div");
  pop.className = "coach-pop";
  const tips = COACH_TIPS[page] || ["what should I do first?", "anything I can help with?"];
  pop.innerHTML = `
    <div class="coach-pop-head">✦ Coach · ${esc(page)}</div>
    <div class="coach-suggs">
      ${tips.map((t, i) => `<button class="coach-sugg" data-i="${i}">${esc(t)}</button>`).join("")}
    </div>
    <form class="coach-form">
      <input class="coach-in" placeholder="ask anything about this page…">
      <button class="coach-go" type="submit">↵</button>
    </form>
    <div class="coach-out" hidden></div>
  `;
  view.appendChild(pop);

  const out = pop.querySelector(".coach-out");
  const setThinking = (on) => {
    btn.classList.toggle("thinking", !!on);
    pop.classList.toggle("thinking", !!on);
  };

  const ask = async (prompt) => {
    if (!prompt.trim()) return;
    out.hidden = false;
    out.classList.remove("err");
    out.innerHTML = `<div class="thinking-line"><i></i><i></i><i></i></div>`;
    setThinking(true);
    /* cap JSON size so the prompt stays small. ctx is whatever the view
       built (counts, top items, lead text). Context-rich, not exhaustive. */
    const ctxJson = (() => { try { return JSON.stringify(ctx || {}, null, 0).slice(0, 1800); } catch { return "{}"; } })();
    const full = `quick: You're the AI coach on the "${page}" page of Donna. Given this page context (truncated JSON), answer in 1-3 short sentences. No preamble, no lists unless asked.\n\nPage: ${page}\nContext: ${ctxJson}\n\nQuestion: ${prompt}`;
    try {
      const res = await window.donna.askInternal(full);
      const ans = (res && res.answer || "").trim() || "Couldn't think of anything — try again?";
      out.innerHTML = `<div class="coach-ans">${esc(ans)}</div><button class="coach-copy">copy</button>`;
      out.querySelector(".coach-copy").onclick = () => { try { navigator.clipboard.writeText(ans); } catch {} };
    } catch (e) {
      out.classList.add("err");
      out.innerHTML = `<div class="coach-ans">Brain offline — try again in a second.</div>`;
    } finally {
      setThinking(false);
    }
  };

  btn.onclick = (e) => {
    e.stopPropagation();
    const isOpen = pop.classList.toggle("show");
    btn.classList.toggle("open", isOpen);
    if (isOpen) requestAnimationFrame(() => pop.querySelector(".coach-in")?.focus());
  };

  pop.querySelectorAll(".coach-sugg").forEach((s) => {
    s.onclick = () => ask(tips[Number(s.dataset.i)]);
  });
  pop.querySelector(".coach-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = pop.querySelector(".coach-in");
    const v = inp.value.trim(); if (!v) return;
    inp.value = "";
    ask(v);
  });

  /* close on outside click — but never on the button itself */
  setTimeout(() => document.addEventListener("mousedown", function h(e) {
    if (pop.classList.contains("show") && !pop.contains(e.target) && !btn.contains(e.target)) {
      closeCoach();
      document.removeEventListener("mousedown", h);
    }
  }), 0);
  /* close on Escape — single-shot listener, cleaned when the view rerenders */
  const onKey = (e) => { if (e.key === "Escape" && pop.classList.contains("show")) closeCoach(); };
  document.addEventListener("keydown", onKey);
  /* auto-cleanup once the page rerenders. simpler than an observer on every
     internal update: a MutationObserver on `main` for child changes. */
  const mo = new MutationObserver(() => {
    if (!view.contains(btn)) { mo.disconnect(); document.removeEventListener("keydown", onKey); }
  });
  mo.observe(main, { childList: true, subtree: true });
}
