
const VIEWS = { today: vToday, tasks: vTasks, plan: vPlan, ask: vAsk, rhythm: vRhythm, comms: vComms, library: vLibrary, canvas: vCanvas, life: vLife, goals: vGoals, activity: vActivity, log: vLog, settings: vSettings,
  // still callable (embedded elsewhere / palette), not in the sidebar:
  waiting: vWaiting, capture: vCapture, notes: vNotes, ideas: vIdeas, memory: vMemory };
function render() {
  if (!data) return;
  /* fade-out / fade-in crossfade so navigation reads as motion, not a paint
     flicker. 80ms out, then the new view's view-in animation runs naturally. */
  const m = $("#main");
  if (m && m.dataset.view !== view) {
    m.dataset.view = view;
    m.classList.add("fading");
    setTimeout(() => { cur = -1; VIEWS[view](); applySections(); m.classList.remove("fading"); }, 80);
  } else {
    cur = -1; VIEWS[view](); applySections();
  }
}

/* ════════ COMPACT ════════
   Cards: lead · now · pipeline · priorities · ask. Each card checks
   isOn() so the user can toggle in Settings → Sections. Default = all on.
   Lead is the first thing you see — the goal's oneThing, the ONE action
   that moves the week. Live timer if you're focusing.
   is spent here, so every card earns its space. */
const COMPACT_CARDS = [
  { id: "compact.lead",      group: "compact" },
  { id: "compact.now",       group: "compact" },
  { id: "compact.pipeline",  group: "compact" },
  { id: "compact.priorities", group: "compact" },
];

function compactCardLead() {
  const lead = data._leadText;
  if (!lead) return "";
  /* the lead text + the goal name + a single "I'm on it" action */
  return `<div class="c-card c-lead" data-strip="compact.lead">
    <div class="c-card-h">◷ THIS WEEK'S LEAD</div>
    <div class="c-card-body">${esc(lead)}</div>
  </div>`;
}

function compactCardNow() {
  const doing = data.open.find((t) => t.status === "doing");
  if (!doing) return "";
  return `<div class="c-card c-now" data-strip="compact.now">
    <div class="c-card-h"><span class="c-card-h-eyebrow">◷ Focusing</span>
      <span class="c-card-h-timer" data-started="${doing.startedAt}">${elapsed(doing.startedAt)}</span></div>
    <div class="c-card-body">${esc(doing.title)}</div>
    <div class="c-card-acts">
      <button class="mini-btn go" data-done="${doing.id}">✓ Done</button>
      <button class="mini-btn" data-start="${doing.id}">Pause</button>
    </div>
  </div>`;
}

function compactCardPipeline() {
  // No external pipeline in the public build.
  return "";
}

function compactCardPriorities() {
  const doing = data.open.find((t) => t.status === "doing");
  const list = data.open
    .filter((t) => t.status !== "doing" && !t.waitingOn)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
  return `<div class="c-card c-priorities" data-strip="compact.priorities">
    <div class="c-card-h">${doing ? "UP NEXT" : "PRIORITIES"}</div>
    ${list.length ? `<div class="c-list">${list.map((t) => rowHtml(t, { compact: true })).join("")}</div>`
      : `<div class="empty" style="padding:10px 12px;font-size:12px">Clean board. Nice.</div>`}
  </div>`;
}

function renderCompactBody() {
  if (!data) return;
  const body = $("#c-body");
  if (!body) return;
  const cards = [];
  if (window.sections.isOn("compact.lead")) cards.push(compactCardLead());
  if (window.sections.isOn("compact.now")) cards.push(compactCardNow());
  if (window.sections.isOn("compact.pipeline")) cards.push(compactCardPipeline());
  if (window.sections.isOn("compact.priorities")) cards.push(compactCardPriorities());
  body.innerHTML = `
    ${cards.join("")}
    <div class="c-add"><input id="c-add-in" placeholder='Add — "email sam tomorrow p1"'></div>`;
  const ai = $("#c-add-in");
  ai.value = localStorage.getItem("donna.draft") || "";
  enhanceCapture(ai);
  ai.addEventListener("input", () => localStorage.setItem("donna.draft", ai.value));
  ai.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && ai.value.trim()) {
      await window.donna.addTask(ai.value.trim());
      ai.value = ""; localStorage.removeItem("donna.draft");
      await refresh(); renderCompactBody(); toast("Task added");
    }
  });
  wireRows(body);
  body.querySelectorAll("[data-goto]").forEach((el) => (el.onclick = () => gotoView(el.dataset.goto)));
}

$("#c-ask").addEventListener("keydown", async (e) => {
  const inp = e.target;
  if (e.key === "Enter" && inp.value.trim()) {
    const q = inp.value.trim(); inp.value = "";
    const ans = $("#c-answer");
    ans.hidden = false;
    ans.innerHTML = '<div class="thinking-line"><i></i><i></i><i></i></div>';
    const res = await window.donna.ask(q);
    typewrite(ans, res.answer, null);
    if (res.tier === "capture") { await refresh(); renderCompactBody(); }
  }
});

/* ════════ HUD toast ════════ */
let toastTimer = null;
function toast(msg, ok = true) {
  const el = $("#toast");
  el.innerHTML = `${ok ? '<span class="ok">✓</span>' : ""}${esc(msg)}`;
  el.hidden = false; el.classList.remove("out");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.add("out"); setTimeout(() => (el.hidden = true), 240); }, 1400);
}

/* ════════ command palette (⌘K) ════════ */
const pal = $("#palette"), palIn = $("#palette-in"), palList = $("#palette-list");
let palSel = 0, palItems = [];

const ICONS = {
  view: '<svg viewBox="0 0 16 16"><path d="M2.5 8s2-4.5 5.5-4.5S13.5 8 13.5 8s-2 4.5-5.5 4.5S2.5 8 2.5 8z"/><circle cx="8" cy="8" r="1.8"/></svg>',
  task: '<svg viewBox="0 0 16 16"><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3"/><path d="M5.4 8.2l1.8 1.8 3.4-3.8"/></svg>',
  add: '<svg viewBox="0 0 16 16"><path d="M8 3.5v9M3.5 8h9"/></svg>',
  ask: '<svg viewBox="0 0 16 16"><path d="M8 1.8l1.5 3.6 3.6 1.5-3.6 1.5L8 12l-1.5-3.6-3.6-1.5 3.6-1.5z"/></svg>',
  mode: '<svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="M9 2.5v11"/></svg>',
};

function fuzzy(q, s) {
  q = q.toLowerCase(); s = s.toLowerCase();
  if (!q) return 1;
  if (s.includes(q)) return 3 + q.length / s.length;
  let i = 0;
  for (const c of s) if (c === q[i]) i++;
  return i === q.length ? 1 : 0;
}
function bold(label, q) {
  if (!q) return esc(label);
  const i = label.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(label);
  return esc(label.slice(0, i)) + "<b>" + esc(label.slice(i, i + q.length)) + "</b>" + esc(label.slice(i + q.length));
}
const looksLikeSentence = (q) => /\s/.test(q.trim()) && (/\?$/.test(q) || q.trim().split(/\s+/).length >= 4);

function buildActions(q) {
  const acts = [];
  if (q.trim()) acts.push({
    sec: "Ask", icon: ICONS.ask, label: `Ask: "${q.trim()}"`, hint: "AI",
    score: looksLikeSentence(q) ? 10 : 0.5, // sentences promote Ask to the top (Raycast blur)
    run: () => { gotoView("ask"); sendAsk(q.trim()); },
  });
  /* custom aliases — user-saved commands. Resolved first because
     they have the highest intent match (user typed the exact key). */
  if (q.trim()) {
    const aliases = (() => { try { return JSON.parse(localStorage.getItem("donna.aliases") || "{}"); } catch { return {}; } })();
    const k = q.trim().split(/\s+/)[0].toLowerCase();
    if (aliases[k]) {
      acts.push({
        sec: "Alias", icon: ICONS.mode, label: `${k} → ${aliases[k]}`, hint: "saved",
        score: 20,
        run: () => { const v = aliases[k]; gotoView("ask"); sendAsk(v); },
      });
    } else if (q.trim().length <= 16 && !/\s/.test(q.trim())) {
      /* unknown short word — offer to ask the brain. Cheap, async.
         Falls through to the regular fuzzy nav/ask results. */
      acts.push({
        sec: "Alias", icon: ICONS.mode, label: `ask Donna: what does "${q.trim()}" mean?`, hint: "AI",
        score: 8,
        run: async () => {
          const r = await window.donna.askInternal(`quick: in one short sentence, what does '${q.trim()}' mean? If you don't know, say "not a recognized term".`);
          toast(r || "—");
        },
      });
    }
  }
  const nav = [
    ["today", "Go to Today", "⌘1"], ["plan", "Go to Plan", "⌘2"], ["tasks", "Go to Tasks", "⌘3"],
    ["goals", "Go to Goals", "⌘4"], ["rhythm", "Go to Tracker", "⌘5"], ["ask", "Go to Ask", "⌘6"],
    ["library", "Go to Library", "⌘7"], ["settings", "Go to Settings", "⌘8"],
  ];
  for (const [v, label, hint] of nav)
    acts.push({ sec: "Navigate", icon: ICONS.view, label, hint, score: fuzzy(q, label), run: () => gotoView(v) });
  // actions that DO things (Raycast/Linear model)
  acts.push(
    { sec: "Do", icon: ICONS.add, label: "New note", hint: "", score: fuzzy(q, "new note write"), run: () => { gotoView("notes"); setTimeout(() => $("#note-add") && $("#note-add").focus(), 90); } },
    { sec: "Do", icon: ICONS.task, label: "Triage inbox", hint: "cards", score: fuzzy(q, "triage inbox process overdue"), run: () => { const u = data ? data.open.filter(isUntriaged) : []; const overdue = data ? data.open.filter((t) => t.dueAt && t.dueAt < new Date().toISOString().slice(0, 10) && t.status !== "doing") : []; const q2 = [...new Set([...u, ...overdue])]; q2.length ? openTriage(q2) : toast("Nothing to triage — clean"); } },
    { sec: "Do", icon: ICONS.mode, label: "Plan the day", hint: "ritual", score: fuzzy(q, "plan the day morning ritual"), run: openMorningPlan },
    { sec: "Do", icon: ICONS.mode, label: "Wind down the day", hint: "", score: fuzzy(q, "wind down shutdown end day"), run: openShutdown },
    { sec: "Do", icon: ICONS.mode, label: "Weekly review", hint: "", score: fuzzy(q, "weekly review zoom out"), run: openWeeklyReview },
    { sec: "Do", icon: ICONS.mode, label: "Friday briefing", hint: "AI", score: fuzzy(q, "friday briefing weekly recap"), run: () => { try { openBriefingModal(); } catch {} } },
    { sec: "Do", icon: ICONS.add, label: "Remind me…", hint: "", score: fuzzy(q, "remind me reminder alert"), run: openReminder },
    { sec: "Do", icon: ICONS.mode, label: "Dock to corner", hint: "compact", score: fuzzy(q, "dock compact corner"), run: () => window.donna.setMode("compact") },
    { sec: "Do", icon: ICONS.mode, label: "Collapse to pill", hint: "pill", score: fuzzy(q, "pill collapse minimize"), run: () => window.donna.setMode("pill") },
  );
  const topTask = data && data.open.slice().sort((a, b) => a.priority - b.priority).find((t) => t.status !== "doing");
  if (topTask) acts.push({ sec: "Do", icon: ICONS.task, label: `Start focus: ${trunc(topTask.title, 30)}`, hint: "", score: fuzzy(q, "start focus " + topTask.title) * 0.8, run: async () => { await window.donna.setStatus(topTask.id, "doing"); await refresh(); render(); renderCompactBody(); toast("On it — focus started"); } });
  if (data) for (const t of data.open) {
    const sc = fuzzy(q, t.title);
    if (q && sc > 0) acts.push({
      sec: "Complete task", icon: ICONS.task, label: t.title, hint: `P${t.priority}`, score: sc * 0.9,
      run: async () => { await window.donna.completeTask(t.id); await refresh(); render(); renderCompactBody(); toast("Done — " + t.title.slice(0, 40)); },
    });
  }
  if (q.trim() && searchCache.length) for (const it of searchCache) {
    if (it.type === "task") continue; // tasks handled by Complete-task above
    const sc = fuzzy(q, it.title);
    if (sc > 0) acts.push({ sec: "Jump to", icon: ICONS.view, label: it.title, hint: it.type, score: sc * 0.85, run: () => gotoView(it.view) });
  }
  if (q.trim()) acts.push({
    sec: "Create", icon: ICONS.add, label: `Add task: "${q.trim()}"`, hint: "↵", score: 0.55,
    run: async () => { await window.donna.addTask(q.trim()); await refresh(); render(); renderCompactBody(); toast("Task added"); },
  });
  return acts.filter((a) => a.score > 0).sort((a, b) => b.score - a.score).slice(0, 9);
}

function paintPalette() {
  const q = palIn.value;
  palItems = buildActions(q);
  palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
  let lastSec = null;
  palList.innerHTML = palItems.map((a, i) => {
    const sec = a.sec !== lastSec ? `<div class="pal-sec">${a.sec}</div>` : "";
    lastSec = a.sec;
    return `${sec}<div class="pal-item ${i === palSel ? "sel" : ""}" data-i="${i}">${a.icon}<span>${bold(a.label, q)}</span><span class="pal-hint">${a.hint || ""}</span></div>`;
  }).join("");
  palList.querySelectorAll(".pal-item").forEach((el) => {
    el.onmouseenter = () => { if (palSel !== Number(el.dataset.i)) { palSel = Number(el.dataset.i); paintPalette(); } };
    el.onclick = () => runPal();
  });
}
function openPalette() { pal.hidden = false; palIn.value = ""; palSel = 0; paintPalette(); requestAnimationFrame(() => palIn.focus()); }
function closePalette() { pal.hidden = true; }
function runPal() { const a = palItems[palSel]; if (a) { closePalette(); a.run(); } }

palIn.addEventListener("input", () => { palSel = 0; paintPalette(); });
palIn.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); palSel = (palSel + 1) % palItems.length; paintPalette(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); palSel = (palSel - 1 + palItems.length) % palItems.length; paintPalette(); }
  else if (e.key === "Enter") runPal();
  else if (e.key === "Escape") closePalette();
});
pal.addEventListener("mousedown", (e) => { if (e.target === pal) closePalette(); });

function gotoView(v) {
  if (document.body.dataset.mode !== "full") window.donna.setMode("full");
  view = v;
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === v));
  render();
}

/* ════════ keyboard state machine ════════ */
window.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const inInput = document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

  if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); pal.hidden ? openPalette() : closePalette(); return; }
  if (mod && e.key >= "1" && e.key <= "9") {
    const v = ["today", "plan", "tasks", "goals", "rhythm", "ask", "library", "settings"][Number(e.key) - 1];
    if (v) { e.preventDefault(); gotoView(v); }
    return;
  }
  if (mod && e.key.toLowerCase() === "n") {
    e.preventDefault();
    const inp = $("#today-add") || $("#task-in") || $("#c-add-in");
    if (inp) inp.focus(); else { gotoView("tasks"); setTimeout(() => $("#task-in")?.focus(), 80); }
    return;
  }
  if (e.key === "Escape") {
    if (!pal.hidden) { closePalette(); return; }
    if (popEl) { closePop(); return; }
    if (inInput && document.activeElement.value) { document.activeElement.value = ""; return; }
    window.donna.hide();
    return;
  }
  if (inInput || !pal.hidden) return;

  /* Linear keyboard model — list contexts (today + tasks list) */
  const listActive = document.body.dataset.mode === "full" && (view === "today" || (view === "tasks" && taskLayout === "list")) && curList.length;
  if (!listActive) return;
  const k = e.key.toLowerCase();
  if (k === "j" || e.key === "ArrowDown") { e.preventDefault(); cur = Math.min(cur + 1, curList.length - 1); paintCursor(); }
  else if (k === "k" || e.key === "ArrowUp") { e.preventDefault(); cur = Math.max(cur - 1, 0); paintCursor(); }
  else if ((k === " " || e.key === "Enter") && cur >= 0) {
    e.preventDefault();
    const t = curList[cur];
    const row = document.querySelector(`.row[data-id="${t.id}"]`);
    if (k === " ") completeWithAnim(t.id, row);
    else row?.classList.toggle("open");
  }
  else if (["1", "2", "3"].includes(e.key) && cur >= 0) {
    e.preventDefault();
    window.donna.setPriority(curList[cur].id, Number(e.key)).then(async () => { await refresh(); render(); toast(`P${e.key}`); });
  }
  else if (k === "s" && cur >= 0) {
    e.preventDefault();
    const row = document.querySelector(`.row[data-id="${curList[cur].id}"]`);
    if (row) openSnooze(curList[cur].id, row.getBoundingClientRect());
  }
  else if (k === "d" && cur >= 0) { // start / stop — the Now state
    e.preventDefault();
    const t = curList[cur];
    window.donna.setStatus(t.id, t.status === "doing" ? "todo" : "doing")
      .then(async () => { await refresh(); render(); renderCompactBody(); toast(t.status === "doing" ? "Paused" : "On it"); });
  }
  else if (k === "w" && cur >= 0) { // waiting-on popover
    e.preventDefault();
    const row = document.querySelector(`.row[data-id="${curList[cur].id}"]`);
    if (row) openWaitPop(curList[cur].id, row.getBoundingClientRect());
  }
  else if (k === "v" && cur >= 0) { // this evening ⇄ back (Things)
    e.preventDefault();
    const t = curList[cur];
    window.donna.setTaskField(t.id, "bucket", t.bucket === "evening" ? null : "evening")
      .then(async () => { await refresh(); render(); toast(t.bucket === "evening" ? "Back to the day" : "Moved to This Evening"); });
  }
  else if (k === "o" && cur >= 0) { // someday — parked, out of every count
    e.preventDefault();
    const t = curList[cur];
    window.donna.setTaskField(t.id, "bucket", t.bucket === "someday" ? null : "someday")
      .then(async () => { if (t.bucket !== "someday") await window.donna.setDue(t.id, null); await refresh(); render(); toast(t.bucket === "someday" ? "Back in play" : "Parked in Someday"); });
  }
  else if (k === "x" && cur >= 0) { // won't do — honest closure
    e.preventDefault();
    const t = curList[cur];
    openWontDoModal(trunc(t.title, 56), t.id).then(async (reason) => {
      if (reason === null) return;
      if (!reason.trim()) { toast("Tell me why (or cancel)"); return; }
      await window.donna.setWontDo(t.id, reason.trim());
      await refresh(); render(); renderCompactBody(); toast("Let go.");
    });
  }
  else if (k === "c") { e.preventDefault(); ($("#today-add") || $("#task-in"))?.focus(); }
});

/* ════════ mode plumbing ════════ */
function setBodyMode(m) {
  document.body.dataset.mode = m;
  document.body.classList.remove("morphing");
  if (m === "compact") renderCompactBody();
  if (m === "full") render();
}
window.donna.onModeWill?.(() => document.body.classList.add("morphing"));
window.donna.onMode(setBodyMode);
$("#btn-compact").onclick = () => window.donna.setMode("compact");
const orbBtn = $("#btn-orb");
if (orbBtn) {
  window.donna.orbStatus().then((s) => orbBtn.classList.toggle("on", s.visible));
  orbBtn.onclick = async () => { const visible = await window.donna.orbToggle(); orbBtn.classList.toggle("on", visible); toast(visible ? "Orb popped out — drag it anywhere" : "Orb tucked away"); };
}
$("#btn-full").onclick = () => window.donna.setMode("full");
$("#btn-pill").onclick = () => window.donna.setMode("pill");
$("#pill-app").onclick = () => window.donna.setMode("compact");

$("#nav").addEventListener("click", (e) => {
  const b = e.target.closest(".nav-item");
  if (!b) return;
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  b.classList.add("active");
  view = b.dataset.view;
  render();
});

window.donna.onState((s) => {
  ["orb-full", "orb-compact", "orb-pill"].forEach((id) => { const o = document.getElementById(id); if (o) o.className = "orb " + (s || "idle"); });
});
window.donna.onToken(() => {}); // brain answers arrive whole; typewriter handles the reveal

/* always-synced: watchers push live refresh + notifications */
window.donna.onRefresh?.(() => {
  refresh().then(() => { if (document.body.dataset.mode === "compact") renderCompactBody(); else if (view !== "ask") render(); });
  refreshProd().then(() => { if (view === "production" || view === "today") { if (document.body.dataset.mode === "full") render(); } });
});
window.donna.onNotify?.((msg) => toast(msg));
window.donna.onGoto?.((v) => { if (VIEWS[v]) gotoView(v); });
/* ambient memory glint (Dot's green flash) — she remembered something */
window.donna.onRemembered?.((n) => {
  const el = $("#toast");
  el.innerHTML = `<span class="ok" style="color:oklch(0.8 0.13 160)">✦</span>remembered${n > 1 ? ` ×${n}` : ""} — see Memory`;
  el.hidden = false; el.classList.remove("out");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.add("out"); setTimeout(() => (el.hidden = true), 240); }, 2200);
});

/* "Since you were here" — track last-seen, on every show compute the
   digest (activity since last seen). If >4h, jump to Today + show digest.
   Same logic runs on every window-open after the first. */
let lastSeenAt = null;
let sinceDigest = null;

function showSinceLeft() {
  if (!lastSeenAt || !sinceDigest) return;
  const items = sinceDigest;
  sinceDigest = null;
  if (!items.length) return;
  /* fire a transient digest card — top of Today, dismissible, animated */
  if (window.openSinceLeftCard) window.openSinceLeftCard(items, lastSeenAt);
}

async function computeSinceLeft() {
  const prev = lastSeenAt;
  if (!prev) return;
  const list = await window.donna.activityList({ since: prev, limit: 50 });
  sinceDigest = list;
  const hrs = (Date.now() - prev) / 3600000;
  /* if >4h, jump to Today and show digest */
  if (hrs >= 4 && view !== "today") { gotoView("today"); }
  showSinceLeft();
}

window.donna.onShow?.(() => {
  /* remember previous last-seen, then on close write a new one */
  const prev = lastSeenAt;
  if (prev) {
    /* user just came back — compute digest against the previous last-seen */
    setTimeout(() => computeSinceLeft().catch(() => {}), 60);
  } else {
    /* first open after boot */
    lastSeenAt = Date.now();
  }
});

window.donna.onHide?.(() => {
  /* when main fires hide, persist the new last-seen so the next open
     can compute "since you were here" against the right window. */
  try {
    lastSeenAt = Date.now();
    localStorage.setItem("donna.lastSeenAt", String(lastSeenAt));
  } catch {}
});

/* boot */
(async () => {
  const qp = new URLSearchParams(location.search); // dev QA hook
  if (qp.get("view") && VIEWS[qp.get("view")]) view = qp.get("view");
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === view));
  if (qp.get("layout")) taskLayout = qp.get("layout");
  const init = await window.donna.init();
  data = init.tasks;
  prod = init.production || null;
  cfg = init.config || {};
  habitsCache = init.habits || [];
  remindersCache = init.reminders || [];
  replacementsCache = init.replacements || [];
  window.donna.searchIndex().then((s) => (searchCache = s || []));
  /* load last-seen from previous session */
  try { lastSeenAt = Number(localStorage.getItem("donna.lastSeenAt")) || null; } catch {}
  /* immediately compute digest for the splash on open */
  if (lastSeenAt) { computeSinceLeft().catch(() => {}); }
  paintChrome();
  setBodyMode(init.mode || "full");
  render();
  if (!cfg.onboarded && (init.mode || "full") === "full") setTimeout(openOnboarding, 700);
  refreshProd().then(() => { if (view === "today" || view === "production") render(); });
  setInterval(() => { refresh(); refreshProd().then(() => { if (view === "today") render(); }); window.donna.searchIndex().then((s) => (searchCache = s || [])); window.donna.remindersList().then((r) => (remindersCache = r || [])); }, 60000); // live refresh
  setInterval(tickTimers, 1000); // focus-session clock
})();
