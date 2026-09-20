
/* Smart "Up Next" — score every open task, return the top one for the hero
   card. Considers: priority, overdue, due-today, lead-measure alignment
   (which task best advances the active goal's oneThing?), and time-of-day
   (morning → deep work, post-lunch → lighter). Replaces the naive
   "first non-doing task by priority" used to live here. */
function smartPick() {
  const doing = data.open.find((t) => t.status === "doing");
  if (doing) return { task: doing, focusing: true };
  const pool = data.open.filter((t) => t.status !== "doing" && !t.waitingOn);
  if (!pool.length) return { task: null, focusing: false };
  const h = new Date().getHours();
  const today = new Date().toISOString().slice(0, 10);
  const leadWords = (data._leadText || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scored = pool.map((t) => {
    let s = 0;
    if (t.priority === 1) s += 100;
    if (t.priority === 2) s += 40;
    if (t.dueAt && t.dueAt.slice(0, 10) < today) s += 80;          // overdue = the only thing that matters
    else if (t.dueAt && t.dueAt.slice(0, 10) === today) s += 50;   // due today
    else if (t.dueAt && t.dueAt.slice(0, 10) < new Date(Date.now() + 86400000).toISOString().slice(0, 10)) s += 25;
    if (t.bucket === "today") s += 30;
    if (t.area === "work") s += h < 14 ? 10 : 0;                    // mornings = work hours
    if (t.area === "money") s += 10;
    if (t.area === "health" && (h < 7 || h >= 18)) s += 20;         // gym window
    if (t.area === "relationships" && h >= 19) s += 10;
    // lead-measure alignment — does the task's words match the goal's oneThing?
    if (leadWords.length) {
      const tw = t.title.toLowerCase();
      const matches = leadWords.filter((w) => tw.includes(w)).length;
      s += matches * 12;
    }
    return { t, s };
  }).sort((a, b) => b.s - a.s);
  return { task: scored[0]?.t || null, focusing: false };
}

function vToday() {
  stagger = 0;
  curList = [];
  const pick = smartPick();
  const hero = pick.task;
  const doing = pick.focusing;
  const queue = data.open.filter((t) => t.status !== "doing" && !t.waitingOn && t.id !== hero?.id);
  const also = queue.slice(0, 3);
  const more = data.counts.open - (hero ? 1 : 0) - also.length;
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const vibe = data.counts.open === 0 ? "you're clear" : data.counts.p1 >= 3 ? "a full one" : data.counts.open <= 3 ? "a light one" : "a steady one";
  main.innerHTML = `<div class="view home">
    <div class="home-head">
      <h1 class="home-hi">${greeting()}, ${esc((cfg && cfg.userName) || "there")}</h1>
      <p class="home-date">${date}<span class="sep">·</span>${vibe}${data.counts.doneToday ? `<span class="sep">·</span>${data.counts.doneToday} shipped` : ""}</p>
      <div class="sleep-strip" data-strip="today.sleep"></div>
    </div>
    <div id="brief-slot" data-strip="today.brief"></div>
    <div id="since-slot"></div>
    <div id="lead-slot" data-strip="today.lead"></div>
    <div id="week-slot" data-strip="today.week"></div>
    ${hero ? heroCard(hero, !!doing) : `<div class="home-clear">Nothing needs you right now.<br><span>Enjoy it, or capture something below.</span></div>`}
    <div data-strip="today.nudge">${nudgeCard()}</div>
    ${also.length ? `<div class="home-also" data-strip="today.also">
      <div class="also-label">Also on your plate</div>
      ${also.map(alsoRow).join("")}
      ${more > 0 ? `<button class="also-more" data-goto="tasks">${more} more in Tasks →</button>` : ""}
    </div>` : ""}
    <div data-strip="today.reminders">${remindersStrip()}</div>
    <div data-strip="today.routines">${routinesStrip()}${replacementsStrip()}</div>
    <div id="diag-slot" data-strip="today.diagnostic"></div>
    <div id="waiting-slot" data-strip="today.waiting"></div>
    <div class="quick-add home-add"><input id="today-add" placeholder='Add — "email sam tomorrow p1"'></div>
    ${localStorage.getItem("donna.planned") !== new Date().toISOString().slice(0, 10) && new Date().getHours() < 14 ? `<button class="wind-btn plan-btn" id="mplan-btn">☀ Plan the day — 2 minutes, then it's locked</button>` : ""}
    ${new Date().getHours() >= 18 ? `<button class="wind-btn" id="wind-btn">☾ Wind down the day</button>` : ""}
  </div>`;
  wireAdd($("#today-add"));
  wireHome(main);
  main.querySelectorAll(".wait-goto").forEach((b) => (b.onclick = () => { try { vWaiting(); } catch {} }));
  wireRoutines(main);
  wireReplacements(main);
  const wb = $("#wind-btn"); if (wb) wb.onclick = openShutdown;
  const mp = $("#mplan-btn"); if (mp) mp.onclick = openMorningPlan;
  /* contextual coach — vibe, lead, top open task, pipeline stage counts.
     The coach only gets a tiny slice of state so the prompt stays cheap. */
  openCoachButton("today", {
    vibe, open: data.counts.open, p1: data.counts.p1,
    doneToday: data.counts.doneToday || 0,
    hero: hero ? { title: hero.title, priority: hero.priority, due: hero.dueAt } : null,
    lead: (data._leadText || "").slice(0, 220),
    also: also.map((t) => t.title),
  });
  ensureBrief().then((text) => { if (view === "today" && text) { const el = $("#brief-slot"); if (el) { el.innerHTML = briefCard(text); wireBrief(); } } });
  /* surface the top goal's lead action + week-at-a-glance in parallel.
     The lead text also feeds the smartPick scorer above via data._leadText. */
  Promise.all([window.donna.goalsTopLead(), window.donna.goalsWeek(), window.donna.waitingRollup()]).then(([lead, week, wroll]) => {
    if (view !== "today") return;
    if (lead && lead.oneThing) {
      data._leadText = lead.oneThing; // feed the scorer for future re-renders
      const slot = $("#lead-slot");
      if (slot) {
        slot.innerHTML = leadCard(lead);
        slot.querySelector("[data-lead-goal]")?.addEventListener("click", () => gotoView("goals"));
      }
    }
    if (week && week.committed > 0) {
      const slot = $("#week-slot");
      if (slot) slot.innerHTML = weekStrip(week);
    }
    if (wroll && wroll.total > 0) {
      const slot = $("#waiting-slot");
      if (slot) {
        slot.innerHTML = waitingStrip(wroll);
        /* re-apply sections filter — the slot was hidden when empty, now it's
           filled, so make sure the toggle still applies */
        try { applySections(); } catch {}
        main.querySelectorAll(".wait-goto").forEach((b) => (b.onclick = () => { try { vWaiting(); } catch {} }));
      }
    }
    /* sleep chip — last night's sleep + 7-day avg. Click to log tonight. */
    window.donna.notesDaily().catch(() => {});
    Promise.all([window.donna.sleepGet(), window.donna.sleepAverage()]).then(([s, avg]) => {
      const strip = $(".sleep-strip");
      if (!strip) return;
      if (!s) {
        strip.innerHTML = `<button class="sleep-chip sleep-empty" data-sleep-set>◷ Log last night's sleep</button>`;
      } else {
        const tone = s.hours < 6 ? "low" : s.hours < 7 ? "meh" : s.hours < 8 ? "ok" : "great";
        strip.innerHTML = `<button class="sleep-chip sleep-${tone}" data-sleep-set>◷ ${s.hours.toFixed(1)}h last night${avg ? ` · <span class="sleep-avg">${avg.toFixed(1)}h avg</span>` : ""}</button>`;
      }
      strip.querySelector("[data-sleep-set]")?.addEventListener("click", openSleepPopover);
    });

    /* boot diagnostic — silent-issue radar. Once per day unless re-shown. */
    window.donna.diagnostic().then((diag) => {
      if (!diag || !diag.issues || !diag.issues.length) return;
      const dismissedDate = localStorage.getItem("donna.diagDismissed");
      if (dismissedDate === diag.runAt.slice(0, 10)) return;
      const slot = $("#diag-slot");
      if (slot) {
        slot.innerHTML = diagnosticCard(diag.issues);
        try { applySections(); } catch {}
        slot.querySelector(".diag-x")?.addEventListener("click", () => {
          localStorage.setItem("donna.diagDismissed", new Date().toISOString().slice(0, 10));
          slot.innerHTML = "";
        });
        slot.querySelectorAll("[diag-goto]").forEach((b) => (b.onclick = () => gotoView(b.dataset.goto)));
        slot.querySelectorAll("[diag-kind]").forEach((b) => (b.onclick = () => { const k = b.dataset.diagKind; if (k === "waiting") { try { vWaiting(); } catch {} } }));
      }
    });
  });
}

function waitingStrip(w) {
  const cls = w.alert > 0 ? "alert" : w.stale > 0 ? "stale" : "fresh";
  const verb = w.alert > 0 ? "alert" : w.stale > 0 ? "going stale" : "tracked";
  return `<div class="wait-strip wait-${cls}">
    <div class="wait-eyebrow">⏳ WAITING ON PEOPLE <span class="wait-verb">· ${verb}</span></div>
    <div class="wait-body">${w.alert ? `<b class="wait-alert">${w.alert}</b> alert (48h+)` : ""}${w.alert && w.stale ? " · " : ""}${w.stale ? `<b>${w.stale}</b> stale (12h+)` : ""}${(!w.alert && !w.stale) ? `<b>${w.total}</b> tracked` : ""} </div>
    <button class="wait-goto" data-goto="waiting">review →</button>
  </div>`;
}

function diagnosticCard(issues) {
  const top = issues.slice(0, 4);
  return `<div class="diag-card msg-in">
    <div class="diag-head">
      <span class="diag-eyebrow">⚡ DIAGNOSTIC · ${issues.length} silent issue${issues.length > 1 ? "s" : ""}</span>
      <button class="diag-x" title="Snooze until tomorrow">×</button>
    </div>
    <div class="diag-rows">
      ${top.map((it) => `<div class="diag-row diag-${it.severity}">
        <span class="diag-i">${esc(it.icon || "·")}</span>
        <div class="diag-body">
          <div class="diag-t">${esc(it.title)}</div>
          ${it.body ? `<div class="diag-b">${esc(it.body)}</div>` : ""}
        </div>
        ${it.action && it.action.goto ? `<button class="diag-go" diag-goto="${esc(it.action.goto)}">→</button>` : ""}
        ${it.action && it.action.kind ? `<button class="diag-go" diag-kind="${esc(it.action.kind)}">→</button>` : ""}
      </div>`).join("")}
    </div>
  </div>`;
}

function weekStrip(w) {
  return `<div class="week-strip">
    <div class="week-eyebrow">WEEK LEAD-MEASURE</div>
    <div class="week-body"><b>${w.done}/${w.committed}</b> committed actions done across <b>${w.goals}</b> active goal${w.goals !== 1 ? "s" : ""}</div>
    <div class="week-bar"><div class="week-fill" style="width:${w.pct}%"></div></div>
    <div class="week-meta"><span>${w.pct}%</span><span>${w.pct >= 70 ? "on pace" : w.pct >= 40 ? "behind" : "stalled"}</span></div>
  </div>`;
}

function leadCard(lead) {
  const pct = lead.pct || 0;
  return `<div class="lead-strip">
    <div class="lead-eyebrow">◷ THIS WEEK'S LEAD <span class="lead-obj">${esc(lead.objective)}</span></div>
    <div class="lead-body">${esc(lead.oneThing)}</div>
    <div class="lead-meta">
      <div class="lead-bar"><div class="lead-fill" style="width:${pct}%"></div></div>
      <span class="lead-pct">${pct}%</span>
      <button class="lead-goal" data-lead-goal>open goal →</button>
    </div>
  </div>`;
}

function heroCard(t, focusing) {
  const hint = t.detail ? `<span class="hero-hint">${esc(t.detail.slice(0, 88))}${t.detail.length > 88 ? "…" : ""}</span>` : "";
  /* inline chips — click P to cycle, click due to pick a date, click ⋯ for
     more (snooze / waiting / won't do). No leaving Today. */
  return `<div class="hero ${focusing ? "focusing" : ""}" data-id="${t.id}">
    <div class="hero-eyebrow">${focusing ? `◷ Focusing · <span data-started="${t.startedAt}">${elapsed(t.startedAt)}</span>` : "Start here"}</div>
    <div class="hero-title">${esc(t.title)}</div>
    <div class="hero-meta">
      <button class="hero-chip" data-prio="${t.id}" title="Click to cycle priority">${pGlyph(t.priority)}<span class="hero-chip-l">P${t.priority}</span></button>
      <button class="hero-chip" data-due="${t.id}" title="Click to set due date">${dueChip(t.dueAt) || `<span class="hero-chip-l dim">no due</span>`}</button>
      <button class="hero-chip hero-more" data-more="${t.id}" title="More">⋯</button>
    </div>
    ${hint ? `<div class="hero-hint-row">${hint}</div>` : ""}
    <div class="hero-acts">
      ${focusing
        ? `<button class="hero-btn go" data-done="${t.id}">✓ Done</button><button class="hero-btn" data-start="${t.id}">Pause</button>`
        : `<button class="hero-btn go" data-start="${t.id}">▸ Start focus</button><button class="hero-btn" data-done="${t.id}">✓ Done</button>`}
    </div>
  </div>`;
}
function alsoRow(t) {
  return `<div class="also-row" data-id="${t.id}">
    <button class="check sm" data-done="${t.id}">${CHECK_SVG}</button>
    <span class="also-title">${esc(t.title)}</span>
    <span class="also-meta">${statusChip(t)}</span>
  </div>`;
}
function wireHome(scope) {
  scope.querySelectorAll("[data-done]").forEach((el) => (el.onclick = (e) => {
    e.stopPropagation(); completeWithAnim(el.dataset.done, null);
  }));
  scope.querySelectorAll("[data-start]").forEach((el) => (el.onclick = async () => {
    const t = data.open.find((x) => x.id === el.dataset.start);
    await window.donna.setStatus(el.dataset.start, t?.status === "doing" ? "todo" : "doing");
    await refresh(); render(); renderCompactBody();
    toast(t?.status === "doing" ? "Paused" : "On it — focus started");
  }));
  scope.querySelectorAll("[data-goto]").forEach((el) => (el.onclick = () => gotoView(el.dataset.goto)));
  /* inline re-prio — cycle P1→P2→P3→P1 with one click, no nav */
  scope.querySelectorAll("[data-prio]").forEach((el) => (el.onclick = async (e) => {
    e.stopPropagation();
    const id = el.dataset.prio;
    const t = data.open.find((x) => x.id === id);
    if (!t) return;
    const next = t.priority === 1 ? 2 : t.priority === 2 ? 3 : 1;
    await window.donna.setPriority(id, next);
    await refresh(); render(); renderCompactBody();
    toast(`Priority → P${next}`);
  }));
  /* inline due-date — tiny popover with quick presets + custom date */
  scope.querySelectorAll("[data-due]").forEach((el) => (el.onclick = (e) => {
    e.stopPropagation();
    openDuePopover(el, el.dataset.due);
  }));
  /* more — snooze / waiting / won't do, inline popover */
  scope.querySelectorAll("[data-more]").forEach((el) => (el.onclick = (e) => {
    e.stopPropagation();
    openMorePopover(el, el.dataset.more);
  }));
}

/* Inline due-date popover. Quick presets: today, tomorrow, +3d, next
   Monday, clear. Anchored to the chip. */
function openDuePopover(anchor, taskId) {
  closePop();
  const r = anchor.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "ipop";
  pop.style.cssText = `position:fixed; top:${r.bottom + 6}px; left:${Math.max(8, r.left - 90)}px; z-index:160;`;
  const today = new Date(); const iso = (d) => d.toISOString().slice(0, 10);
  const t = iso(today);
  const tom = new Date(today); tom.setDate(tom.getDate() + 1); const tIso = iso(tom);
  const d3 = new Date(today); d3.setDate(d3.getDate() + 3); const d3Iso = iso(d3);
  const mon = new Date(today); const dow = (mon.getDay() + 6) % 7; mon.setDate(mon.getDate() + (7 - dow) % 7 || 7); const mIso = iso(mon);
  pop.innerHTML = `<div class="ipop-head">Set due</div>
    <div class="ipop-grid">
      <button class="ipop-btn" data-due-set="${t}">Today</button>
      <button class="ipop-btn" data-due-set="${tIso}">Tomorrow</button>
      <button class="ipop-btn" data-due-set="${d3Iso}">+3 days</button>
      <button class="ipop-btn" data-due-set="${mIso}">Mon</button>
      <button class="ipop-btn" data-due-set="">Clear</button>
    </div>`;
  document.body.appendChild(pop);
  curPop = pop;
  pop.querySelectorAll("[data-due-set]").forEach((b) => (b.onclick = async () => {
    const v = b.dataset.dueSet || null;
    await window.donna.setDue(taskId, v);
    await refresh(); render(); renderCompactBody();
    closePop();
    toast(v ? `Due → ${v.slice(5)}` : "Due cleared");
  }));
  setTimeout(() => { document.addEventListener("click", closePop, { once: true, capture: true }); }, 50);
}

function openMorePopover(anchor, taskId) {
  closePop();
  const r = anchor.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "ipop";
  pop.style.cssText = `position:fixed; top:${r.bottom + 6}px; left:${Math.max(8, r.left - 100)}px; z-index:160;`;
  pop.innerHTML = `<div class="ipop-head">More</div>
    <div class="ipop-stack">
      <button class="ipop-btn" data-more-act="snooze">Snooze to tonight</button>
      <button class="ipop-btn" data-more-act="evening">This evening</button>
      <button class="ipop-btn" data-more-act="someday">Park in someday</button>
      <button class="ipop-btn" data-more-act="waiting">Waiting on someone…</button>
      <button class="ipop-btn" data-more-act="recur-daily">↻ Repeat every day</button>
      <button class="ipop-btn" data-more-act="recur-weekdays">↻ Repeat weekdays</button>
      <button class="ipop-btn" data-more-act="recur-weekly">↻ Repeat weekly</button>
      <button class="ipop-btn" data-more-act="recur-off">Stop repeating</button>
      <button class="ipop-btn ipop-danger" data-more-act="wontdo">Won't do…</button>
    </div>`;
  document.body.appendChild(pop);
  curPop = pop;
  pop.querySelectorAll("[data-more-act]").forEach((b) => (b.onclick = async () => {
    const act = b.dataset.moreAct;
    closePop();
    if (act === "wontdo") {
      const reason = await openWontDoModal("park", taskId);
      if (reason == null || !reason.trim()) return;
      await window.donna.setWontDo(taskId, reason.trim());
      await refresh(); render(); renderCompactBody();
      toast("Let go.");
      return;
    }
    if (act === "snooze") {
      const d = new Date(); d.setHours(20, 0, 0, 0);
      await window.donna.setDue(taskId, d.toISOString().slice(0, 10));
      await refresh(); render(); renderCompactBody();
      toast("Snoozed to tonight 8pm");
      return;
    }
    if (act === "recur-daily" || act === "recur-weekdays" || act === "recur-weekly") {
      const freq = act.replace("recur-", "");
      await window.donna.setTaskField(taskId, "recurrence", { freq });
      await refresh(); render(); renderCompactBody();
      toast(`Repeats ${freq}`);
      return;
    }
    if (act === "recur-off") {
      await window.donna.setTaskField(taskId, "recurrence", null);
      await refresh(); render(); renderCompactBody();
      toast("Repeat cleared");
      return;
    }
    if (act === "evening") { await window.donna.setTaskField(taskId, "bucket", "evening"); await refresh(); render(); renderCompactBody(); toast("This evening"); return; }
    if (act === "someday") { await window.donna.setTaskField(taskId, "bucket", "someday"); await refresh(); render(); renderCompactBody(); toast("Parked in someday"); return; }
    if (act === "waiting") {
      const who = await _openModal({ title: "Waiting on", placeholder: "Someone", body: `<div class="pm-hint">Who owes you this? Donna will start the partner timer.</div>`, confirmLabel: "Mark waiting" });
      if (who == null || !who.trim()) return;
      await window.donna.setWaiting(taskId, who.trim());
      await refresh(); render(); renderCompactBody();
      toast(`Now waiting on ${who.trim()}`);
    }
  }));
  setTimeout(() => { document.addEventListener("click", closePop, { once: true, capture: true }); }, 50);
}

let curPop = null;
function closePop() { if (curPop) { curPop.remove(); curPop = null; } }

/* sleep popover — quick presets + custom hours input */
function openSleepPopover() {
  closePop();
  const anchor = document.querySelector("[data-sleep-set]");
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "ipop";
  pop.style.cssText = `position:fixed; top:${r.bottom + 6}px; left:${Math.max(8, r.left)}px; z-index:160;`;
  pop.innerHTML = `<div class="ipop-head">Last night's sleep</div>
    <div class="ipop-grid">
      <button class="ipop-btn" data-sleep-h="9">9h · great</button>
      <button class="ipop-btn" data-sleep-h="8">8h · great</button>
      <button class="ipop-btn" data-sleep-h="7">7h · ok</button>
      <button class="ipop-btn" data-sleep-h="6">6h · low</button>
      <button class="ipop-btn" data-sleep-h="5">5h · tired</button>
      <button class="ipop-btn" data-sleep-h="4.5">&lt;5h · rough</button>
    </div>
    <div class="ipop-stack" style="margin-top:6px">
      <input class="ipop-in" id="sleep-custom" type="number" min="0" max="14" step="0.5" placeholder="Custom hours (e.g. 7.5)">
      <button class="ipop-btn" data-sleep-custom>Save</button>
    </div>`;
  document.body.appendChild(pop);
  curPop = pop;
  pop.querySelectorAll("[data-sleep-h]").forEach((b) => (b.onclick = async () => {
    await window.donna.sleepSet({ hours: Number(b.dataset.sleepH) });
    closePop();
    await refresh();
    paint();
    toast(`Logged ${b.dataset.sleepH}h sleep`);
  }));
  pop.querySelector("[data-sleep-custom]").onclick = async () => {
    const v = pop.querySelector("#sleep-custom").value;
    if (!v || Number(v) < 0) return;
    await window.donna.sleepSet({ hours: Number(v) });
    closePop();
    await refresh();
    paint();
    toast(`Logged ${v}h sleep`);
  };
  setTimeout(() => pop.querySelector("#sleep-custom")?.focus(), 60);
  setTimeout(() => { document.addEventListener("click", closePop, { once: true, capture: true }); }, 50);
}

/* morning brief — one AI sentence on how to start the day, generated once/day (M3) */
async function ensureBrief() {
  const today = new Date().toISOString().slice(0, 10);
  let c = null; try { c = JSON.parse(localStorage.getItem("donna.brief")); } catch {}
  if (c && c.date === today) return c.dismissed ? null : c.text;
  const res = await window.donna.askInternal("quick: In ONE short punchy sentence, tell me how to start my day given my open tasks. Just the sentence — no preamble, no lists.");
  const raw = (res.answer || "").trim();
  // Never surface provider/config errors as a "brief".
  if (!raw || /^\((?:[^)]*(?:not set|unavailable|couldn.t reach|error))/i.test(raw)) return null;
  const text = raw.replace(/^["']|["']$/g, "");
  localStorage.setItem("donna.brief", JSON.stringify({ date: today, text, dismissed: false }));
  return text;
}
function briefCard(text) {
  return `<div class="brief"><span class="brief-icon">✦</span><span class="brief-text">${esc(text)}</span><button class="brief-x" title="Dismiss">×</button></div>`;
}
function wireBrief() {
  const x = document.querySelector(".brief-x");
  if (x) x.onclick = () => {
    let c = {}; try { c = JSON.parse(localStorage.getItem("donna.brief")) || {}; } catch {}
    c.dismissed = true; localStorage.setItem("donna.brief", JSON.stringify(c));
    document.querySelector(".brief")?.remove();
  };
}

function wireAdd(inp) {
  if (!inp) return;
  enhanceCapture(inp); // live token highlighting — what's marked is what parses
  inp.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && inp.value.trim()) {
      await window.donna.addTask(inp.value.trim());
      inp.value = "";
      try { snd.pop(); } catch {}
      await refresh(); render(); toast("Task added");
    }
  });
}

/* "Since you were here" digest — a transient card on Today when you return
   after >30min away. Shows the 3 most significant events since last open.
   Dismissible, doesn't break the page if data is empty. */
window.openSinceLeftCard = function (items, lastSeenAt) {
  if (!items || !items.length) return;
  const slot = $("#since-slot");
  if (!slot) return;
  const hrs = (Date.now() - lastSeenAt) / 3600000;
  const ago = hrs < 1 ? `${Math.round(hrs * 60)}m` : hrs < 24 ? `${Math.round(hrs)}h` : `${Math.round(hrs / 24)}d`;
  /* group + summarize */
  const byKind = {};
  for (const e of items) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  const stats = [];
  if (byKind.task_done) stats.push(`<b>${byKind.task_done}</b> task${byKind.task_done > 1 ? "s" : ""} done`);
  if (byKind.goal_week) stats.push(`<b>${byKind.goal_week}</b> weekly commit${byKind.goal_week > 1 ? "s" : ""}`);
  if (byKind.goal_reached) stats.push(`<b>${byKind.goal_reached}</b> goal hit`);
  if (byKind.person_touched) stats.push(`<b>${byKind.person_touched}</b> person touched`);
  if (byKind.note_added) stats.push(`<b>${byKind.note_added}</b> note${byKind.note_added > 1 ? "s" : ""}`);
  if (byKind.task_added) stats.push(`<b>${byKind.task_added}</b> new task${byKind.task_added > 1 ? "s" : ""}`);
  const summary = stats.length ? stats.join(" · ") : `${items.length} events logged`;
  /* the 3 freshest */
  const top = items.slice(0, 3).map((e) => {
    const icon = ({ task_done: "✓", task_added: "+", task_wontdo: "⊘", goal_reached: "★", goal_added: "◎", goal_week: "◷", person_touched: "☎", person_added: "+", note_added: "✎", idea_added: "✦" })[e.kind] || "·";
    return `<div class="since-row"><span class="since-i">${icon}</span><span class="since-t">${esc(e.summary.slice(0, 70))}</span></div>`;
  }).join("");
  slot.innerHTML = `<div class="since-card msg-in">
    <div class="since-head">
      <span class="since-eyebrow">SINCE YOU WERE HERE · ${ago} ago</span>
      <button class="since-x" title="Dismiss">×</button>
    </div>
    <div class="since-summary">${summary}</div>
    <div class="since-rows">${top}</div>
  </div>`;
  slot.querySelector(".since-x").onclick = () => { slot.innerHTML = ""; };
};

