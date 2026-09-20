
/* ════════ FULL views ════════ */

/* the ENTRANCE — a calm welcome, not a wall of work. One hero to start,
   the rest gently secondary. Full task management lives in Tasks. */
/* Smart nudge — ONE calm, contextual suggestion from real state (time, focus,
   pipeline). Never more than one; Donna acting, not bombarding. */
function computeNudge() {
  const h = new Date().getHours();
  const doing = data.open.find((t) => t.status === "doing");
  const p1 = data.counts.p1;
  const voice = (prod && prod.stages) ? ((prod.stages.find((s) => s.key === "voice") || {}).n || 0) : 0;
  if (doing && doing.startedAt) {
    const mins = Math.round((Date.now() - new Date(doing.startedAt)) / 60000);
    if (mins >= 90) return { icon: "◷", text: `You've been on "${trunc(doing.title, 28)}" ${mins >= 120 ? Math.floor(mins / 60) + "h" : mins + "m"} — good point to wrap or breathe.` };
  }
  if (voice > 0 && h >= 9 && h < 22) return { icon: "◆", text: `${voice} master${voice > 1 ? "s" : ""} at the voice gate — clear it and the post gate opens.`, goto: "production" };
  if (h >= 21) return { icon: "☾", text: `Late one — park what's left and call it. Tomorrow's brief will have it ready.` };
  if (h >= 19 && data.counts.doneToday === 0) return { icon: "◐", text: `Nothing shipped yet — one small win before you wind down?`, goto: "tasks" };
  if (p1 >= 3) return { icon: "▲", text: `${p1} P1s today — start the one that unblocks the most, park the rest.`, goto: "tasks" };
  if (h < 11 && data.counts.doneToday === 0 && !doing) return { icon: "☀", text: `Fresh start — your first focus block sets the whole day.` };
  return null;
}
function nudgeCard() {
  const n = computeNudge();
  if (!n) return "";
  return `<div class="nudge"${n.goto ? ` data-goto="${n.goto}"` : ""}><span class="nudge-i">${n.icon}</span><span class="nudge-t">${esc(n.text)}</span>${n.goto ? `<span class="nudge-go">→</span>` : ""}</div>`;
}

/* upcoming reminders — subtle, only when set */
function remindersStrip() {
  if (!remindersCache.length) return "";
  const fmt = (at) => { const d = new Date(at), now = new Date(); const same = d.toDateString() === now.toDateString(); return same ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { weekday: "short" }) + " " + d.toLocaleTimeString([], { hour: "numeric" }); };
  return `<div class="rem-strip">${remindersCache.slice(0, 3).map((r) => `<div class="rem-item"><span class="rem-clock">⏰</span><span class="rem-t">${esc(r.text)}</span><span class="rem-at">${fmt(r.at)}</span></div>`).join("")}</div>`;
}

/* today's routines — recurring behaviors, tick to log. The keystone habit
   (Power of Habit) gets its own highlighted row with a streak, since fixing
   it is meant to cascade into the others rather than being one chip among many. */
function routinesStrip() {
  if (!habitsCache.length) return "";
  const keystone = habitsCache.find((h) => h.keystone);
  const rest = habitsCache.filter((h) => !h.keystone);
  const done = habitsCache.filter((h) => h.doneToday).length;
  return `<div class="routines">
    <div class="rt-label">Routines<span class="rt-count">${done}/${habitsCache.length}</span></div>
    ${keystone ? `<button class="rt-keystone ${keystone.doneToday ? "done" : ""}" data-habit="${keystone.id}" title="${esc(keystone.identity || "")}">
      <span class="rt-key-star">★</span>
      <span class="rt-key-body">
        <span class="rt-key-name">${esc(keystone.name)}</span>
        <span class="rt-key-sub">${esc(keystone.anchor || "")}${keystone.streak ? ` <span class="rt-key-streak">· ${keystone.streak}-day streak</span>` : ""}${keystone.frozen ? ` <span class="rt-freeze" title="You missed ${esc(keystone.frozen)} — I covered it. Streak lives.">❄ covered</span>` : ""}</span>
      </span>
      <span class="rt-check">${CHECK_SVG}</span>
    </button>` : ""}
    <div class="rt-chips">${rest.map((h) => `<button class="rt-chip ${h.doneToday ? "done" : ""}" data-habit="${h.id}" title="${esc(h.identity || h.anchor || "")}"><span class="rt-check">${CHECK_SVG}</span>${esc(h.name)}</button>`).join("")}</div>
  </div>`;
}
function wireRoutines(scope) {
  scope.querySelectorAll("[data-habit]").forEach((el) => (el.onclick = async () => {
    const on = await window.donna.habitsToggle(el.dataset.habit);
    el.classList.toggle("done", on);
    habitsCache = await window.donna.habitsList();
    const c = scope.querySelector(".rt-count"); if (c) c.textContent = `${habitsCache.filter((h) => h.doneToday).length}/${habitsCache.length}`;
    if (on) { // instant celebration (Tiny Habits) — the win lands the second it's logged, not later
      const h = habitsCache.find((x) => x.id === el.dataset.habit);
      try { snd.chime(); if (h && h.keystone) burstFrom(el.querySelector(".rt-check"), { n: 12, hue: 85 }); } catch {}
      toast(h && h.identity ? `✓ ${h.identity}${h.votes ? ` — vote #${h.votes} this month` : ""}` : "Nailed it");
    }
  }));
}

/* habit replacements — swap the routine, keep the cue and reward (Power of
   Habit). Logged like a habit: held today, or not, streak shown honestly. */
function replacementsStrip() {
  if (!replacementsCache.length) return "";
  return `<div class="routines replacements">
    <div class="rt-label">Replacing<span class="rt-count">${replacementsCache.filter((r) => r.heldToday).length}/${replacementsCache.length}</span></div>
    ${replacementsCache.map((r) => `<button class="rt-replace ${r.heldToday ? "done" : ""}" data-replace="${r.id}">
      <span class="rt-check">${CHECK_SVG}</span>
      <span class="rt-key-body">
        <span class="rt-key-name">${esc(r.name)}</span>
        <span class="rt-key-sub">${esc(r.cue)} → <b>${esc(r.newRoutine)}</b>${r.streak ? ` <span class="rt-key-streak">· ${r.streak}-day streak</span>` : ""}</span>
      </span>
    </button>`).join("")}
  </div>`;
}
function wireReplacements(scope) {
  scope.querySelectorAll("[data-replace]").forEach((el) => (el.onclick = async () => {
    const on = await window.donna.replacementsToggle(el.dataset.replace);
    el.classList.toggle("done", on);
    replacementsCache = await window.donna.replacementsList();
    const c = scope.querySelector(".replacements .rt-count"); if (c) c.textContent = `${replacementsCache.filter((r) => r.heldToday).length}/${replacementsCache.length}`;
    if (on) { const r = replacementsCache.find((x) => x.id === el.dataset.replace); toast(r ? `✓ ${r.reward}` : "Held it"); }
  }));
}

/* ════════ GENERIC PROMPT MODAL ════════
   The replacement for native prompt() — proper dark-themed modal, single
   input + confirm/cancel. Returns the entered value (or null on cancel).
   Also exposes openReasonModal for the won't-do flow. */
function _openModal({ title, body, confirmLabel = "OK", cancelLabel = "Cancel", placeholder = "", value = "", onSubmit }) {
  if ($("#prompt-modal")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.id = "prompt-modal";
    el.innerHTML = `<div class="sd-panel pm-panel">
      <div class="sd-h">${esc(title || "")}</div>
      ${body ? `<div class="pm-body">${body}</div>` : ""}
      <input class="pm-input" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off" spellcheck="false">
      <div class="pm-acts">
        <button class="pm-cancel">${esc(cancelLabel)}</button>
        <button class="pm-confirm">${esc(confirmLabel)}</button>
      </div>
    </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    const inp = el.querySelector(".pm-input");
    setTimeout(() => inp.focus(), 60);
    const close = (v) => { el.classList.remove("show"); setTimeout(() => el.remove(), 160); resolve(v); };
    const submit = () => close(inp.value);
    el.querySelector(".pm-cancel").onclick = () => close(null);
    el.querySelector(".pm-confirm").onclick = submit;
    inp.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      else if (e.key === "Escape") { e.preventDefault(); close(null); }
    };
    el.onclick = (e) => { if (e.target === el) close(null); };
    if (onSubmit) onSubmit({ input: inp, submit, close });
  });
}

/* Won't-do modal — replaces the native prompt() in shell.js X shortcut.
   "Park this with a reason" — the reason field is required, forces honesty. */
function openWontDoModal(taskTitle, taskId) {
  return _openModal({
    title: "Won't do",
    body: `<div class="pm-task">${esc(taskTitle)}</div><div class="pm-hint">One honest line why (required) — keeps the log honest.</div>`,
    confirmLabel: "Park it",
    cancelLabel: "Keep it",
    placeholder: "doesn't matter anymore / wrong priority / done elsewhere…",
    onSubmit: ({ input, submit, close }) => {
      const update = () => {
        const v = input.value.trim();
        if (!v) { input.classList.add("pm-err"); return; }
        submit();
      };
      input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); update(); } };
      el_replace_submit: {
        const btn = document.querySelector("#prompt-modal .pm-confirm");
        btn.onclick = update;
      }
    },
  });
}

/* Weekly commit modal — replaces the dual prompt() calls in vGoals.
   Two-number stepper (committed / done) with a quick-log of what got done. */
function openWeeklyCommitModal({ goal, onCommit }) {
  if ($("#wkc-modal")) return;
  const wk = goal.week || { committed: 0, done: 0 };
  const el = document.createElement("div");
  el.id = "wkc-modal";
  el.innerHTML = `<div class="sd-panel wkc-panel">
    <div class="sd-h">This week's execution</div>
    <div class="wkc-obj">${esc(goal.objective)}</div>
    <div class="wkc-grid">
      <div class="wkc-cell"><label>Committed</label><div class="stepper"><button data-wkc="-c">−</button><span id="wkc-c">${wk.committed || 0}</span><button data-wkc="+c">+</button></div></div>
      <div class="wkc-cell"><label>Done</label><div class="stepper"><button data-wkc="-d">−</button><span id="wkc-d">${wk.done || 0}</span><button data-wkc="+d">+</button></div></div>
    </div>
    <div class="wkc-pct" id="wkc-pct">${wk.committed ? Math.round((wk.done / wk.committed) * 100) : 0}%</div>
    <div class="pm-hint">Lead measure = the actions YOU control. Lag = the KRs.</div>
    <div class="pm-acts">
      <button class="pm-cancel">Cancel</button>
      <button class="pm-confirm">Log week</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  const close = () => { el.classList.remove("show"); setTimeout(() => el.remove(), 160); };
  const updatePct = () => {
    const c = Number(el.querySelector("#wkc-c").textContent);
    const d = Number(el.querySelector("#wkc-d").textContent);
    el.querySelector("#wkc-pct").textContent = c ? Math.round((d / c) * 100) + "%" : "0%";
  };
  el.querySelectorAll("[data-wkc]").forEach((b) => (b.onclick = () => {
    const op = b.dataset.wkc[0], field = b.dataset.wkc[1];
    const sel = `#wkc-${field}`;
    const v = Math.max(0, Number(el.querySelector(sel).textContent) + (op === "+" ? 1 : -1));
    el.querySelector(sel).textContent = v;
    updatePct();
  }));
  el.querySelector(".pm-cancel").onclick = close;
  el.querySelector(".pm-confirm").onclick = () => {
    const c = Number(el.querySelector("#wkc-c").textContent);
    const d = Number(el.querySelector("#wkc-d").textContent);
    onCommit(c, d);
    close();
  };
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelector(".pm-cancel").onkeydown = (e) => { if (e.key === "Escape") close(); };
}

/* Shutdown ritual — the evening bookend to the morning brief. Recap + roll
   forward + one line, then close the day. */
async function openShutdown() {
  if ($("#shutdown")) return;
  const r = await window.donna.rhythm();
  const fmt = (m) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}`;
  const d = new Date(); d.setDate(d.getDate() + 1);
  const tomorrow = d.toISOString().slice(0, 10);
  const openTasks = data.open.filter((t) => t.status !== "done").sort((a, b) => a.priority - b.priority).slice(0, 6);
  /* planned vs actual — the honesty ledger (Sunsama). Only rows with both. */
  const todayIso = new Date().toISOString().slice(0, 10);
  const shipped = data.done.filter((t) => (t.updatedAt || "").slice(0, 10) === todayIso && t.estimatedMinutes && t.actualMinutes);
  const el = document.createElement("div");
  el.id = "shutdown";
  el.innerHTML = `<div class="sd-panel">
    <div class="sd-h">Today, wrapped</div>
    <div class="sd-stats">${data.counts.doneToday || 0} shipped<span class="sep">·</span>${fmt(r.todayMin)} focused${r.streak ? `<span class="sep">·</span>${r.streak}-day streak` : ""}</div>
    <div class="sd-recap" id="sd-recap"><div class="thinking-line"><i></i><i></i><i></i></div></div>
    ${shipped.length ? `<div class="sd-sec">Planned vs actual — where your estimates lie</div>
      <div class="sd-list">${shipped.slice(0, 5).map((t) => { const ratio = t.actualMinutes / t.estimatedMinutes; return `<div class="sd-row"><span class="sd-t">${esc(trunc(t.title, 36))}</span><span class="sd-pa ${ratio > 1.3 ? "over" : ""}">${fmt(t.estimatedMinutes)} → ${fmt(t.actualMinutes)}</span></div>`; }).join("")}</div>` : ""}
    ${openTasks.length ? `<div class="sd-sec">Still open — roll it or release it</div>
      <div class="sd-list">${openTasks.map((t) => `<div class="sd-row" data-id="${t.id}"><span class="sd-t">${pGlyph(t.priority)} ${esc(trunc(t.title, 36))}</span><button class="sd-roll" data-roll="${t.id}">Tomorrow →</button><button class="sd-nix" data-nix="${t.id}" title="Won't do — let it go">⊘</button></div>`).join("")}</div>`
      : `<div class="sd-clear">Nothing left open — clean slate. Nice one.</div>`}
    <div class="sd-sec">One line on today <span class="sd-opt">optional</span></div>
    <input id="sd-reflect" class="sd-input" placeholder="What mattered · what's on your mind…" spellcheck="false">
    <div class="sd-acts"><button class="hero-btn go" id="sd-done">Done for the day</button><button class="hero-btn" id="sd-cancel">Not yet</button></div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  const close = () => { el.classList.remove("show"); setTimeout(() => el.remove(), 200); };
  /* the honest tracker recap, generated while you review the list */
  window.donna.dayRecap().then((rec) => {
    const slot = $("#sd-recap");
    if (!slot) return;
    if (rec && rec.ok && rec.text) slot.innerHTML = `<span class="brief-icon">✦</span><span>${esc(rec.text)}</span>`;
    else slot.remove();
  }).catch(() => { const s = $("#sd-recap"); if (s) s.remove(); });
  el.querySelectorAll("[data-roll]").forEach((b) => (b.onclick = async () => {
    await window.donna.setDue(b.dataset.roll, tomorrow);
    b.textContent = "rolled ✓"; b.disabled = true; b.closest(".sd-row").classList.add("rolled");
  }));
  el.querySelectorAll("[data-nix]").forEach((b) => (b.onclick = async () => {
    await window.donna.setWontDo(b.dataset.nix, "released at shutdown");
    b.closest(".sd-row").classList.add("rolled");
    const roll = b.closest(".sd-row").querySelector(".sd-roll"); if (roll) roll.disabled = true;
    b.textContent = "released"; b.disabled = true;
  }));
  el.querySelector("#sd-cancel").onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelector("#sd-done").onclick = async () => {
    const txt = $("#sd-reflect").value.trim();
    if (txt) await window.donna.reflect(txt);
    await refresh(); close();
    toast("Day closed. Rest well.");
    setTimeout(() => window.donna.hide(), 700);
  };
  $("#sd-reflect").focus();
}

/* Weekly review — the GTD zoom-out: what shipped, focus trend, what's stuck. */
async function openWeeklyReview() {
  if ($("#weekrev")) return;
  const [r, waiting, hist, goals, notes] = await Promise.all([
    window.donna.rhythm(), window.donna.waitingList(),
    window.donna.trackerHistory(7).catch(() => []),
    window.donna.goalsList().catch(() => []),
    window.donna.notesList().catch(() => []),
  ]);
  const fmt = (m) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}`;
  const doneWeek = data.done.filter((t) => { const d = t.updatedAt || t.completedAt; return d && (Date.now() - new Date(d)) < 7 * 86400000; });
  const stale = waiting.filter((w) => w.stale);
  const maxW = Math.max(60, ...r.week.map((d) => d.minutes));
  /* tracked truth for the week + weekly goal execution + a resurfaced note */
  const wkActive = hist.reduce((n, h) => n + (h.activeMin || 0), 0);
  const wkDeep = hist.reduce((n, h) => n + (h.deepMin || 0), 0);
  const wkPulse = hist.length ? Math.round(hist.reduce((n, h) => n + (h.pulse || 0), 0) / hist.filter((h) => h.activeMin > 0).length || 0) : 0;
  const liveGoals = goals.filter((g) => !g.done && g.week && g.week.committed);
  const oldNote = notes.filter((n) => n.updatedAt && (Date.now() - new Date(n.updatedAt)) > 30 * 86400000)
    .sort(() => 0.5 - Math.random())[0];
  const el = document.createElement("div");
  el.id = "weekrev";
  el.innerHTML = `<div class="sd-panel" style="width:min(480px,92vw)">
    <div class="sd-h">Your week</div>
    <div class="sd-stats">${doneWeek.length} shipped<span class="sep">·</span>${fmt(r.weekMin)} focused${r.streak ? `<span class="sep">·</span>${r.streak}-day streak` : ""}</div>
    ${wkActive ? `<div class="sd-stats" style="margin-top:2px">tracked: ${fmt(wkActive)} active<span class="sep">·</span>${fmt(wkDeep)} deep<span class="sep">·</span>pulse ~${wkPulse}</div>` : ""}
    <div class="sd-sec">Focus this week</div>
    <div class="rh-chart" style="height:88px">${r.week.map((d, i) => `<div class="rh-col ${i === 6 ? "today" : ""}"><div class="rh-bar-wrap"><div class="rh-bar" style="height:${d.minutes ? Math.max(4, Math.round(d.minutes / maxW * 100)) : 0}%"></div></div><div class="rh-day">${d.day}</div></div>`).join("")}</div>
    ${liveGoals.length ? `<div class="sd-sec">Weekly execution — the lead measure</div>
      <div class="sd-list">${liveGoals.map((g) => { const p = g.week.committed ? Math.round(g.week.done / g.week.committed * 100) : 0; return `<div class="sd-row"><span class="sd-t">${esc(trunc(g.objective, 38))}</span><span class="sd-pa ${p < 70 ? "over" : ""}">${g.week.done}/${g.week.committed} · ${p}%</span></div>`; }).join("")}</div>` : ""}
    ${stale.length ? `<div class="sd-sec">Still stuck — chase these</div><div class="sd-list">${stale.map((w) => `<div class="sd-row"><span class="sd-t">${esc(w.item)}</span><span class="wait-age stale">${w.days}d</span></div>`).join("")}</div>`
      : `<div class="sd-clear">Nothing stuck on anyone. Clean.</div>`}
    ${oldNote ? `<div class="sd-sec">From your library — worth a re-read</div>
      <div class="sd-row"><span class="sd-t">↺ ${esc(trunc(oldNote.title, 44))}</span><span class="sd-pa">${new Date(oldNote.updatedAt).toLocaleDateString()}</span></div>` : ""}
    <div class="sd-sec">One line on the week <span class="sd-opt">optional</span></div>
    <input id="wr-reflect" class="sd-input" placeholder="Biggest win · one thing to change next week…" spellcheck="false">
    <div class="sd-acts"><button class="hero-btn go" id="wr-done">Close the week</button><button class="hero-btn" id="wr-cancel">Later</button></div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  const close = () => { el.classList.remove("show"); setTimeout(() => el.remove(), 200); };
  el.querySelector("#wr-cancel").onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelector("#wr-done").onclick = async () => {
    const t = $("#wr-reflect").value.trim();
    if (t) await window.donna.reflect("[weekly] " + t);
    close(); toast("Week closed. Fresh slate.");
  };
  $("#wr-reflect").focus();
}

/* First-run setup — 4 gentle steps: your name, your AI key, what Donna may
   read, done. Values are saved to config via setConfig. Shown once. */
const OB_STEPS = [
  { kind: "name", title: "Welcome to Donna", body: "What should I call you?", next: "Continue →" },
  { kind: "ai", title: "Connect your AI", body: "Donna uses your own API key. It stays on this Mac — in ~/Library/Application Support/Donna.", next: "Continue →" },
  { kind: "context", title: "What should Donna know?", body: "Add files or folders she can read when answering. Optional, and nothing is uploaded.", next: "Continue →" },
  { kind: "done", title: "You're all set", body: "Press ⌘⇧Space anywhere to summon Donna. Everything stays local.", next: "Open Today →" },
];

let _obStep = 0;
let _obData = { userName: "", provider: "anthropic", apiKey: "", contextRoots: [] };

function openOnboarding() {
  if ($("#onboard")) return;
  _obStep = 0;
  _obData = {
    userName: (cfg && cfg.userName) || "",
    provider: (cfg && cfg.provider) || "anthropic",
    apiKey: (cfg && cfg.apiKey) || "",
    contextRoots: (cfg && cfg.contextRoots) || [],
  };
  _renderObStep();
}

function _obRenderBody(step) {
  if (step.kind === "name") return `<input id="ob-in" class="sd-input" placeholder="Your name" autofocus>`;
  if (step.kind === "ai") return `
    <select id="ob-provider" class="sd-input">
      <option value="opencode">OpenCode gateway (recommended)</option>
      <option value="anthropic">Anthropic (Claude)</option>
      <option value="openai">OpenAI</option>
      <option value="minimax">MiniMax</option>
      <option value="gemini">Google Gemini</option>
      <option value="claude-cli">Claude CLI (local, no key)</option>
    </select>
    <input id="ob-key" class="sd-input" type="password" placeholder="Paste your API key (or set an env var instead)">
    <div class="ob-hint">Change this later in Settings → General.</div>`;
  if (step.kind === "context") return `
    <div id="ob-roots" class="ob-roots"></div>
    <button class="hero-btn" id="ob-pick" style="width:100%;justify-content:center;margin-top:10px">Choose files / folders…</button>`;
  return `<div class="ob-done-art">✦</div>`;
}

function _obRenderRoots() {
  const wrap = document.querySelector("#ob-roots");
  if (!wrap) return;
  const pretty = (r) => String(r).replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~");
  wrap.innerHTML = _obData.contextRoots.length
    ? _obData.contextRoots.map((r) => `<div class="ob-root"><span class="mono">${esc(pretty(r))}</span><button data-rm="${esc(r)}">×</button></div>`).join("")
    : `<div class="ob-hint">Nothing added yet — you can skip this.</div>`;
  wrap.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => {
    _obData.contextRoots = _obData.contextRoots.filter((x) => x !== b.dataset.rm);
    _obRenderRoots();
  }));
}

function _renderObStep() {
  const old = $("#onboard");
  if (old) old.remove();
  const step = OB_STEPS[_obStep];
  const el = document.createElement("div");
  el.id = "onboard";
  el.innerHTML = `<div class="sd-panel ob-panel" style="width:min(520px,94vw)">
    <div class="ob-progress">${OB_STEPS.map((_, i) => `<span class="ob-pip ${i <= _obStep ? "on" : ""}"></span>`).join("")}</div>
    <div class="ob-orb"></div>
    <div class="sd-h" style="text-align:center">${esc(step.title)}</div>
    <p class="ob-sub">${esc(step.body)}</p>
    ${_obRenderBody(step)}
    <div class="sd-acts" style="margin-top:20px">
      <button class="hero-btn" id="ob-skip">Skip</button>
      <button class="hero-btn go" id="ob-next" style="flex:1;justify-content:center">${esc(step.next)}</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  if (step.kind === "name") {
    const inp = el.querySelector("#ob-in");
    if (inp) { inp.value = _obData.userName; setTimeout(() => inp.focus(), 100); }
  }
  if (step.kind === "ai") {
    const sel = el.querySelector("#ob-provider");
    if (sel) sel.value = _obData.provider;
    const key = el.querySelector("#ob-key");
    if (key) key.value = _obData.apiKey;
  }
  if (step.kind === "context") {
    _obRenderRoots();
    el.querySelector("#ob-pick").onclick = async () => {
      try {
        const paths = await window.donna.pickContext();
        if (paths && paths.length) {
          _obData.contextRoots = [...new Set([..._obData.contextRoots, ...paths])];
          _obRenderRoots();
        }
      } catch (e) { /* ignore */ }
    };
  }
  el.querySelector("#ob-skip").onclick = () => _obFinish(el);
  el.querySelector("#ob-next").onclick = async () => {
    const cur = OB_STEPS[_obStep];
    if (cur.kind === "name") _obData.userName = (el.querySelector("#ob-in")?.value || "").trim();
    if (cur.kind === "ai") {
      _obData.provider = el.querySelector("#ob-provider")?.value || "anthropic";
      _obData.apiKey = (el.querySelector("#ob-key")?.value || "").trim();
    }
    _obStep++;
    if (_obStep >= OB_STEPS.length) { await _obFinish(el); return; }
    _renderObStep();
  };
  const inp = el.querySelector("#ob-in");
  if (inp) inp.onkeydown = (e) => { if (e.key === "Enter") el.querySelector("#ob-next").click(); };
}

async function _obFinish(el) {
  try {
    cfg = await window.donna.setConfig({
      userName: _obData.userName || "",
      provider: _obData.provider || "anthropic",
      apiKey: _obData.apiKey || "",
      contextRoots: _obData.contextRoots || [],
      onboarded: true,
    });
  } catch (e) { console.warn("[onboard]", e); }
  el.classList.remove("show");
  setTimeout(() => el.remove(), 200);
  try { gotoView("today"); } catch {}
  try { await refresh(); } catch {}
  toast("All set — enjoy");
}

/* Remind me — quick time-based poke; main fires the notification when due. */
function openReminder() {
  if ($("#remindov")) return;
  const iso = (d) => d.toISOString();
  const mk = (mins, absHour, tomorrow) => { const d = new Date(); if (mins) d.setMinutes(d.getMinutes() + mins); else { if (tomorrow) d.setDate(d.getDate() + 1); d.setHours(absHour, 0, 0, 0); } return iso(d); };
  const chips = [["in 1 hour", mk(60)], ["in 3 hours", mk(180)], ["tonight 8pm", mk(null, 20)], ["tomorrow 9am", mk(null, 9, true)]];
  const el = document.createElement("div");
  el.id = "remindov";
  el.innerHTML = `<div class="sd-panel" style="width:min(420px,92vw)">
    <div class="sd-h">Remind me…</div>
    <input id="rm-text" class="sd-input" style="margin-top:14px" placeholder="What should Donna remind you about?" spellcheck="false">
    <div class="sd-sec">When</div>
    <div class="rm-chips">${chips.map(([l, at]) => `<button class="rm-chip" data-at="${at}">${l}</button>`).join("")}</div>
    <div class="sd-acts"><button class="hero-btn" id="rm-cancel">Cancel</button></div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  const close = () => { el.classList.remove("show"); setTimeout(() => el.remove(), 200); };
  el.querySelector("#rm-cancel").onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  el.querySelectorAll(".rm-chip").forEach((b) => (b.onclick = async () => {
    const text = $("#rm-text").value.trim();
    if (!text) { $("#rm-text").focus(); return; }
    await window.donna.remindersAdd(text, b.dataset.at);
    close(); toast("Reminder set");
  }));
  $("#rm-text").focus();
}

/* ── Triage — card-by-card inbox zero (TickTick Plan-Your-Day × Linear Triage).
   Never a shame-pile: one task at a time, five keys, 90 seconds to a clean
   board. Every decision is an activation state, not a guilt deferral. ── */
function openTriage(items) {
  if ($("#triage") || !items || !items.length) return;
  const queue = items.slice();
  let i = 0, acted = 0;
  const el = document.createElement("div");
  el.id = "triage";
  document.body.appendChild(el);
  const iso = (d) => d.toISOString().slice(0, 10);
  const dates = () => {
    const t = new Date(); const tom = new Date(t); tom.setDate(t.getDate() + 1);
    const mon = new Date(t); mon.setDate(t.getDate() + ((8 - t.getDay()) % 7 || 7));
    return { today: iso(t), tomorrow: iso(tom), nextweek: iso(mon) };
  };
  function paint() {
    const t = queue[i];
    if (!t) {
      el.innerHTML = `<div class="sd-panel triage-panel">
        <div class="tri-done-orb">✓</div>
        <div class="sd-h" style="text-align:center">Inbox zero</div>
        <p class="ob-sub">${acted} task${acted === 1 ? "" : "s"} triaged. Nothing rots in a pile.</p>
        <div class="sd-acts"><button class="hero-btn go" id="tri-close" style="flex:1;justify-content:center">Done</button></div>
      </div>`;
      el.querySelector("#tri-close").onclick = close;
      try { snd.milestone(); burst(window.innerWidth / 2, window.innerHeight / 2 - 80, { n: 18, hue: 160, dist: 90 }); } catch {}
      return;
    }
    el.innerHTML = `<div class="sd-panel triage-panel">
      <div class="tri-prog">${i + 1} of ${queue.length}</div>
      <div class="tri-card">
        <div class="tri-title">${esc(t.title)}</div>
        ${t.detail ? `<div class="tri-detail">${esc(trunc(t.detail, 140))}</div>` : ""}
        <div class="tri-meta">${projChip(t)}${estChip(t)}${pGlyph(t.priority)}</div>
      </div>
      <div class="tri-acts">
        <button data-act="today"><b>T</b>oday</button>
        <button data-act="tomorrow">To<b>m</b>orrow</button>
        <button data-act="nextweek"><b>N</b>ext week</button>
        <button data-act="someday"><b>S</b>omeday</button>
        <button data-act="wontdo" class="tri-nix"><b>X</b> won't do</button>
        <button data-act="skip" class="tri-skip">skip ⏎</button>
      </div>
    </div>`;
    el.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => act(b.dataset.act)));
  }
  async function act(a) {
    const t = queue[i];
    const d = dates();
    if (a === "today") { await window.donna.setDue(t.id, d.today); await window.donna.setTaskField(t.id, "bucket", "today"); acted++; }
    else if (a === "tomorrow") { await window.donna.setDue(t.id, d.tomorrow); acted++; }
    else if (a === "nextweek") { await window.donna.setDue(t.id, d.nextweek); acted++; }
    else if (a === "someday") { await window.donna.setTaskField(t.id, "bucket", "someday"); acted++; }
    else if (a === "wontdo") { await window.donna.setWontDo(t.id, ""); acted++; }
    if (a !== "skip") { try { snd.tick(); } catch {} }
    i++;
    const card = el.querySelector(".tri-card");
    if (card) { card.classList.add("tri-out"); setTimeout(paint, 130); } else paint();
  }
  function close() {
    window.removeEventListener("keydown", onKey, true);
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
    refresh().then(() => { if (view === "tasks") render(); });
  }
  function onKey(e) {
    e.stopPropagation();
    const k = e.key.toLowerCase();
    if (k === "escape") { e.preventDefault(); close(); }
    else if (k === "t") { e.preventDefault(); act("today"); }
    else if (k === "m") { e.preventDefault(); act("tomorrow"); }
    else if (k === "n") { e.preventDefault(); act("nextweek"); }
    else if (k === "s") { e.preventDefault(); act("someday"); }
    else if (k === "x") { e.preventDefault(); act("wontdo"); }
    else if (k === "enter" || k === " ") { e.preventDefault(); queue[i] ? act("skip") : close(); }
  }
  window.addEventListener("keydown", onKey, true);
  paint();
  requestAnimationFrame(() => el.classList.add("show"));
}

/* ── Morning Plan — the Sunsama ritual, skippable in 10 seconds.
   (1) pick a shutdown time (2) clear untriaged (3) pull tasks into Today
   with estimates against a live capacity meter (4) go. The plan is a
   COMMITMENT you sized, not a wish-pile. ── */
async function openMorningPlan() {
  if ($("#mplan")) return;
  await refresh();
  const todayIso = new Date().toISOString().slice(0, 10);
  const untriaged = data.open.filter(isUntriaged);
  const already = data.open.filter((t) => t.bucket !== "someday" && !t.waitingOn && ((t.dueAt && t.dueAt <= todayIso) || t.priority === 1 || t.bucket === "today"));
  const candidates = data.open.filter((t) => !already.includes(t) && t.bucket !== "someday" && !t.waitingOn)
    .sort((a, b) => a.priority - b.priority).slice(0, 12);
  const picked = new Set();
  const capMin = (cfg.capacityHours || 6) * 60;
  const el = document.createElement("div");
  el.id = "mplan";
  document.body.appendChild(el);

  const plannedMin = () => [...already, ...candidates.filter((t) => picked.has(t.id))]
    .reduce((n, t) => n + (t.estimatedMinutes || 30), 0);

  function meterHtml() {
    const m = plannedMin();
    const pct = Math.min(100, Math.round((m / capMin) * 100));
    const over = m > capMin;
    return `<div class="mp-meter ${over ? "over" : ""}">
      <div class="mp-meter-l"><b>${fmtMin(m)}</b> planned · ${fmtMin(capMin)} capacity${over ? " — <b>over. cut something.</b>" : ""}</div>
      <div class="cap-track"><div class="cap-fill ${over ? "over" : pct > 75 ? "warn" : ""}" style="width:${pct}%"></div></div>
    </div>`;
  }
  function rowHtml_(t, inToday) {
    const est = t.estimatedMinutes || 30;
    return `<div class="mp-row ${inToday ? "locked" : picked.has(t.id) ? "on" : ""}" data-mp="${t.id}">
      <span class="mp-tick">${inToday ? "●" : picked.has(t.id) ? "✓" : "+"}</span>
      <span class="mp-title">${esc(trunc(t.title, 52))}</span>
      ${pGlyph(t.priority)}
      <button class="mp-est" data-est="${t.id}">${est >= 60 ? (est / 60) + "h" : est + "m"}</button>
    </div>`;
  }
  function paint() {
    const hour = new Date().getHours();
    el.innerHTML = `<div class="sd-panel" style="width:min(520px,94vw)">
      <div class="sd-h">Plan the day</div>
      <div class="sd-stats">${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div>

      <div class="sd-sec">Shutdown at — the day gets a hard edge</div>
      <div class="rm-chips">${[17, 18, 19, 21].map((h) => `<button class="rm-chip ${(cfg.shutdownHour || 19) === h ? "on" : ""}" data-sh="${h}">${h > 12 ? h - 12 + "pm" : h + "am"}</button>`).join("")}</div>

      ${untriaged.length ? `<div class="sd-sec">Inbox first</div>
        <button class="wind-btn" id="mp-triage" style="margin-top:6px">▤ Triage ${untriaged.length} loose task${untriaged.length > 1 ? "s" : ""} — 90 seconds</button>` : ""}

      <div class="sd-sec">Today — committed${already.length ? ` (${already.length} locked in)` : ""}</div>
      <div class="mp-list">${already.map((t) => rowHtml_(t, true)).join("") || '<div class="empty" style="padding:8px 4px">Nothing yet — pull from below.</div>'}</div>

      ${candidates.length ? `<div class="sd-sec">Pull in — click to commit, click the time to size it</div>
        <div class="mp-list">${candidates.map((t) => rowHtml_(t, false)).join("")}</div>` : ""}

      ${meterHtml()}
      <div class="sd-acts">
        <button class="hero-btn go" id="mp-go">Lock the day in</button>
        <button class="hero-btn" id="mp-skip">Skip today</button>
      </div>
    </div>`;
    el.querySelectorAll("[data-sh]").forEach((b) => (b.onclick = async () => { cfg = await window.donna.setConfig({ shutdownHour: Number(b.dataset.sh) }); paint(); }));
    const tri = $("#mp-triage"); if (tri) tri.onclick = () => { close(false); openTriage(untriaged); };
    el.querySelectorAll(".mp-row:not(.locked)").forEach((r) => (r.onclick = (e) => {
      if (e.target.closest(".mp-est")) return;
      const id = r.dataset.mp;
      picked.has(id) ? picked.delete(id) : picked.add(id);
      paint();
    }));
    el.querySelectorAll(".mp-est").forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation();
      const t = [...already, ...candidates].find((x) => x.id === b.dataset.est);
      const steps = [15, 30, 60, 90, 120];
      const next = steps[(steps.indexOf(t.estimatedMinutes || 30) + 1) % steps.length];
      t.estimatedMinutes = next;
      await window.donna.setTaskField(t.id, "estimatedMinutes", next);
      paint();
    }));
    $("#mp-go").onclick = async () => {
      for (const id of picked) { await window.donna.setDue(id, todayIso); await window.donna.setTaskField(id, "bucket", "today"); }
      localStorage.setItem("donna.planned", todayIso);
      close(true);
      toast(`Day locked — ${fmtMin(plannedMin())} committed`);
      try { snd.milestone(); } catch {}
      await refresh(); if (view === "today" || view === "tasks") render();
    };
    $("#mp-skip").onclick = () => { localStorage.setItem("donna.planned", todayIso); close(false); };
  }
  function close(_ok) { el.classList.remove("show"); setTimeout(() => el.remove(), 200); }
  el.onclick = (e) => { if (e.target === el) close(false); };
  paint();
  requestAnimationFrame(() => el.classList.add("show"));
}

/* Friday briefing modal — the on-demand weekly recap. Generated by M3,
   saved as a Note, shown here for review. Re-run anytime. */
async function openBriefingModal() {
  if ($("#brief-modal")) return;
  const el = document.createElement("div");
  el.id = "brief-modal";
  el.innerHTML = `<div class="sd-panel brief-modal">
    <div class="sd-h">Friday briefing</div>
    <div class="brief-loading"><div class="thinking-line"><i></i><i></i><i></i></div><div class="brief-load-t">Reading your week…</div></div>
  </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  let result;
  try { result = await window.donna.briefing({ tier: "think" }); } catch (e) {
    el.querySelector(".sd-panel").innerHTML = `<div class="sd-h">Friday briefing</div><div class="brief-err">Couldn't reach the brain: ${esc(e.message || "unknown")}</div><div class="sd-acts"><button class="hero-btn" id="brief-close">Close</button></div>`;
    el.querySelector("#brief-close").onclick = () => { el.classList.remove("show"); setTimeout(() => el.remove(), 200); };
    return;
  }
  const d = result.data;
  el.querySelector(".sd-panel").innerHTML = `
    <div class="sd-h">Friday briefing — ${esc(d.weekStart)} → ${esc(d.weekEnd)}</div>
    <div class="brief-grid">
      <div class="brief-stat"><b>${d.tasksDoneThisWeek}</b><span>shipped</span></div>
      <div class="brief-stat ${d.waitingAlert ? "alert" : ""}"><b>${d.waitingAlert}</b><span>alerts</span></div>
      <div class="brief-stat"><b>${d.p1Open}</b><span>P1 open</span></div>
      <div class="brief-stat"><b>${d.avgSleepHours7d || "—"}h</b><span>sleep avg</span></div>
    </div>
    <div class="brief-goals">
      ${d.goals.slice(0, 4).map((g) => `<div class="brief-goal">
        <div class="brief-goal-t">${esc(g.objective)}</div>
        <div class="brief-goal-m"><div class="brief-bar"><div class="brief-bar-fill" style="width:${g.pct}%"></div></div><span>${g.pct}%</span><span class="brief-goal-w">W${g.cycleWeek}/12</span></div>
      </div>`).join("")}
    </div>
    <div class="brief-body">${esc(result.body)}</div>
    <p class="brief-saved">Saved as a Note: <b>${esc(result.title)}</b></p>
    <div class="sd-acts">
      <button class="hero-btn" id="brief-rerun">Regenerate</button>
      <button class="hero-btn go" id="brief-close" style="flex:1;justify-content:center">Done</button>
    </div>`;
  el.querySelector("#brief-close").onclick = () => { el.classList.remove("show"); setTimeout(() => el.remove(), 200); };
  el.querySelector("#brief-rerun").onclick = async () => {
    el.querySelector(".sd-panel").innerHTML = `<div class="sd-h">Friday briefing</div><div class="brief-loading"><div class="thinking-line"><i></i><i></i><i></i></div><div class="brief-load-t">Regenerating…</div></div>`;
    let r2; try { r2 = await window.donna.briefing({ tier: "best" }); } catch {}
    if (r2) { const e2 = el.querySelector(".sd-panel"); e2.innerHTML = el.querySelector(".sd-panel").innerHTML; openBriefingModal.__last = r2; }
    /* simpler: close and re-open */
    el.classList.remove("show"); setTimeout(() => el.remove(), 200);
    openBriefingModal();
  };
}
