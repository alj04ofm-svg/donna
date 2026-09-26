
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
  closeHomePop();
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
  homePop = pop;
  pop.querySelectorAll("[data-due-set]").forEach((b) => (b.onclick = async () => {
    const v = b.dataset.dueSet || null;
    await window.donna.setDue(taskId, v);
    await refresh(); render(); renderCompactBody();
    closeHomePop();
    toast(v ? `Due → ${v.slice(5)}` : "Due cleared");
  }));
  setTimeout(() => { document.addEventListener("click", closeHomePop, { once: true, capture: true }); }, 50);
}

function openMorePopover(anchor, taskId) {
  closeHomePop();
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
  homePop = pop;
  pop.querySelectorAll("[data-more-act]").forEach((b) => (b.onclick = async () => {
    const act = b.dataset.moreAct;
    closeHomePop();
    if (act === "wontdo") {
      const reason = await openWontDoModal(trunc((data.open.find((x) => x.id === taskId) || {}).title || "this task", 56), taskId);
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
  setTimeout(() => { document.addEventListener("click", closeHomePop, { once: true, capture: true }); }, 50);
}

let homePop = null;
function closeHomePop() { if (homePop) { homePop.remove(); homePop = null; } }

/* sleep popover — quick presets + custom hours input */
function openSleepPopover() {
  closeHomePop();
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
  homePop = pop;
  pop.querySelectorAll("[data-sleep-h]").forEach((b) => (b.onclick = async () => {
    await window.donna.sleepSet({ hours: Number(b.dataset.sleepH) });
    closeHomePop();
    await refresh();
    render();
    toast(`Logged ${b.dataset.sleepH}h sleep`);
  }));
  pop.querySelector("[data-sleep-custom]").onclick = async () => {
    const v = pop.querySelector("#sleep-custom").value;
    if (!v || Number(v) < 0) return;
    await window.donna.sleepSet({ hours: Number(v) });
    closeHomePop();
    await refresh();
    render();
    toast(`Logged ${v}h sleep`);
  };
  setTimeout(() => pop.querySelector("#sleep-custom")?.focus(), 60);
  setTimeout(() => { document.addEventListener("click", closeHomePop, { once: true, capture: true }); }, 50);
}

/* morning brief — one AI sentence on how to start the day, generated once/day (M3) */
function briefIsBad(t) {
  return !t || /^\s*\((?:[^)]*(?:not set|unavailable|couldn.t reach|rate limit|error|429|401))/i.test(t);
}
async function ensureBrief() {
  const today = new Date().toISOString().slice(0, 10);
  let c = null; try { c = JSON.parse(localStorage.getItem("donna.brief")); } catch {}
  if (c && c.date === today) {
    if (c.dismissed) return null;
    if (!briefIsBad(c.text)) return c.text;
    // stale/cached error — fall through and regenerate
  }
  const res = await window.donna.askInternal("quick: In ONE short punchy sentence, tell me how to start my day given my open tasks. Just the sentence — no preamble, no lists.");
  const raw = (res.answer || "").trim();
  if (briefIsBad(raw)) return null;
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


/* ═══════════════════════════════════════════════════════════════════════════
   Today v2 — mission control. Hand-built, detail-first:
   · a greeting header with the day's shape at a glance
   · ONE focus card (the thing), with a live timer
   · a slim "day bar" showing time blocks + a now-line (from the scheduler)
   · "up next" list with quiet hover actions
   · routines as tactile pills, waiting-on card, a deep quick-capture
   ═══════════════════════════════════════════════════════════════════════════ */
function _t2pct(v, a, b) { return Math.max(0, Math.min(100, ((v - a) / Math.max(1, b - a)) * 100)); }
function _t2fmtMin(m) { const h = Math.floor(m / 60), mm = m % 60; const ap = h < 12 ? "am" : "pm"; const hh = ((h + 11) % 12) + 1; return `${hh}${mm ? ":" + String(mm).padStart(2, "0") : ""}${ap}`; }
function _t2elapsed(iso) {
  if (!iso) return "0:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s > 12 * 3600) return "—";           // stale/left running — don't show nonsense
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}

async function vToday2() {
  stagger = 0;
  const session = (typeof useSession === "function") ? useSession() : null;
  const name = (cfg && cfg.userName) || (session && session.displayName) || "there";
  let habits = [], waiting = null, plan = null;
  try { habits = await window.donna.habitsList(); } catch {}
  try { waiting = await window.donna.waitingRollup(); } catch {}
  try { plan = await window.donna.plan(); } catch {}

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const open = (data.open || []).slice().sort((a, b) => a.priority - b.priority);
  const doing = open.find((t) => t.status === "doing");
  const hero = doing || open[0] || null;
  const rest = open.filter((t) => t && t.id !== (hero && hero.id)).slice(0, 5);
  curList = [hero, ...rest].filter((t) => t && t.status !== "done");
  const p1 = data.counts.p1 || 0;
  const overdue = open.filter((t) => t.dueAt && String(t.dueAt).slice(0, 10) < new Date().toISOString().slice(0, 10) && t.status !== "doing").length;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const habitsDone = habits.filter((h) => h.doneToday).length;

  const blocks = (plan && plan.blocks) || [];
  const planBlocks = blocks.slice().sort((a, b) => a.s - b.s);
  const busy = (plan && plan.busy) || [];
  const nowMin = (plan && plan.nowMin) || (hour * 60);
  const ds = ((plan && plan.dayStart) || 9) * 60, de = ((plan && plan.dayEnd) || 19) * 60;
  const pctNow = Math.max(0, Math.min(100, _t2pct(nowMin, ds, de)));
  const ticks = []; for (let h = Math.ceil(ds / 60); h <= de / 60; h += 2) ticks.push(h * 60);
  const shape = `
    <div class="t2-bar">
      <span class="t2-bar-past" style="width:${pctNow}%"></span>
      ${busy.map((b) => `<span class="t2-blk busy" style="left:${_t2pct(b.s, ds, de)}%;width:${Math.max(0.8, _t2pct(b.e, ds, de) - _t2pct(b.s, ds, de))}%" title="${esc(b.title || "calendar")}"></span>`).join("")}
      ${blocks.map((b) => `<span class="t2-blk work" style="left:${_t2pct(b.s, ds, de)}%;width:${Math.max(0.8, _t2pct(b.e, ds, de) - _t2pct(b.s, ds, de))}%" title="${esc(b.title || "task")}"></span>`).join("")}
      <i class="t2-now" style="left:${pctNow}%"></i>
    </div>
    <div class="t2-ticks">${ticks.map((m) => `<span style="left:${_t2pct(m, ds, de)}%">${_t2fmtMin(m).replace(":00", "")}</span>`).join("")}</div>
    <div class="t2-bar-key">
      <span class="t2-legend"><i class="lg work"></i>focus <i class="lg busy"></i>calendar</span>
      <span class="t2-key-mid">${doing ? "in focus now" : boxesFree(blocks)}</span>
    </div>`;
  function boxesFree(bs) { const used = bs.reduce((n, b) => n + (b.e - b.s), 0); const total = de - ds; return `${Math.round((total - used) / 60)}h free`; }

  main.innerHTML = `
  <div class="view t2">
    <header class="t2-head">
      <div class="t2-head-l">
        <div class="t2-eyebrow">${esc(dateLabel)}</div>
        <h1 class="t2-greet">${esc(greet)}, <span>${esc(name)}</span></h1>
        <div class="t2-vibe">
          <span class="t2-dot ${p1 ? "p1" : "ok"}"></span>
          ${open.length} open${p1 ? ` · ${p1} P1` : ""}${overdue ? ` · <b>${overdue} overdue</b>` : ""}${habits.length ? ` · routines ${habitsDone}/${habits.length}` : ""}
        </div>
      </div>
      <div class="t2-head-r">
        <button class="t2-btn ghost" id="t2-capture">⌥ Quick capture</button>
        <button class="t2-btn primary" id="t2-plan">✦ Plan my day</button>
      </div>
    </header>

    <div id="since-slot"></div>

    <section class="t2-shape">
      <div class="t2-sec-head"><span>Today's shape</span><em>${_t2fmtMin(ds)} – ${_t2fmtMin(de)}</em></div>
      ${shape}
    </section>

    <div class="t2-grid">
      <div class="t2-main">
        ${hero ? `
        <section class="t2-focus" id="t2-focus" data-id="${hero.id}">
          <div class="t2-focus-top">
            <span class="t2-focus-kicker">${doing ? "In focus" : "Start here"}</span>
            <span class="t2-pri p${hero.priority}">P${hero.priority}</span>
          </div>
          <h2 class="t2-focus-title">${esc(hero.title)}</h2>
          <div class="t2-focus-meta">
            ${depChip(hero)}${tagChips(hero, 3)}
            ${hero.dueAt ? `<span class="t2-meta-chip">📅 ${esc(String(hero.dueAt).slice(0, 10))}</span>` : ""}
            ${hero.estimatedMinutes ? `<span class="t2-meta-chip">⏱ ${hero.estimatedMinutes}m</span>` : ""}
            ${hero.project_id ? `<span class="t2-meta-chip">◈ ${esc(hero.project_id)}</span>` : ""}
            ${hero.subtasks && hero.subtasks.length ? `<span class="t2-meta-chip">☑ ${hero.subtasks.filter((s) => s.done).length}/${hero.subtasks.length}</span>` : ""}
            ${doing && _t2elapsed(doing.startedAt) === "—" ? `<span class="t2-meta-chip">⏱ timer idle</span>` : ""}
            ${doing && _t2elapsed(doing.startedAt) !== "—" ? `<span class="t2-timer" id="t2-timer">${_t2elapsed(doing.startedAt)}</span>` : ""}
          </div>
          <div class="t2-focus-acts">
            <button class="t2-btn primary" id="t2-start">${doing ? "❚❚ Pause" : "▶ Start focus"}</button>
            <button class="t2-btn ghost" id="t2-done">✓ Done</button>
            <button class="t2-btn ghost" id="t2-edit">Edit</button>
          </div>
        </section>` : `
        <section class="t2-focus empty">
          <div class="t2-focus-top"><span class="t2-focus-kicker">Start here</span></div>
          <h2 class="t2-focus-title">Nothing on your plate.</h2>
          <div class="t2-focus-meta"><span>Capture something below and make it the first thing.</span></div>
        </section>`}

        <section class="t2-day">
          <div class="t2-sec-head"><span>Up next</span><em>${rest.length ? `${rest.length} queued` : "clear"}</em></div>
          ${rest.length ? `<div class="t2-upnext">${rest.map((t, i) => `
            <div class="t2-up" data-up="${t.id}" data-idx="${i + 1}">
              <button class="check sm" data-done3="${t.id}" aria-label="Complete">${CHECK_SVG}</button>
              <span class="t2-up-title">${esc(t.title)}</span>
              <span class="t2-up-chips">${depChip(t)}${tagChips(t, 2)}${statusChip(t)}</span>
            </div>`).join("")}</div>` : `<div class="t2-empty">Nothing else queued. Nice.</div>`}
          ${data.counts.open > rest.length + (hero ? 1 : 0) ? `<button class="t2-link" data-goto="tasks">all ${data.counts.open} in Tasks →</button>` : ""}
        </section>

        <section class="t2-day">
          <div class="t2-sec-head"><span>Your day</span><em>${planBlocks.length ? `${planBlocks.length} block${planBlocks.length === 1 ? "" : "s"}${plan && plan.overflow ? ` · ${plan.overflow} didn't fit` : ""}` : "nothing scheduled"}</em></div>
          ${planBlocks.length ? `<div class="t2-timeline">${planBlocks.map((b) => {
            const state = b.e <= nowMin ? "past" : (b.s <= nowMin && b.e > nowMin) ? "now" : "next";
            return `<div class="t2-block ${state}" data-id="${b.id}">
              <span class="t2-block-time">${_t2fmtMin(b.s)}</span>
              <span class="t2-block-rail"><i class="t2-block-dot p${b.priority}"></i></span>
              <div class="t2-block-body">
                <div class="t2-block-title">${esc(b.title)}</div>
                <div class="t2-block-sub">${esc((b.project_id || "no project"))} · ${b.e - b.s}m${b.doing ? " · in progress" : ""}</div>
              </div>
              <div class="t2-block-acts">
                <button class="t2-block-btn" data-start2="${b.id}" title="${state === "now" ? "Pause" : "Start"}">${state === "now" ? "❚❚" : "▶"}</button>
                <button class="t2-block-btn ok" data-done2="${b.id}" title="Complete">✓</button>
              </div>
            </div>`;
          }).join("")}</div>` : `<div class="t2-empty">Nothing time-blocked. Add tasks, then hit <b>Plan my day</b>.</div>`}
          ${plan && plan.overflow ? `<div class="t2-overflow">${plan.overflow} task${plan.overflow === 1 ? "" : "s"} didn't fit today — <button class="t2-link" data-goto="tasks">see them in Tasks →</button></div>` : ""}
        </section>
      </div>

      <aside class="t2-side">
        <section class="t2-card">
          <div class="t2-sec-head"><span>Routines</span><em>${habitsDone}/${habits.length}</em></div>
          <div class="t2-habits">
            ${habits.length ? habits.map((h) => `<button class="t2-habit ${h.doneToday ? "on" : ""}" data-habit="${h.id}">
              <span class="t2-habit-tick">${h.doneToday ? "✓" : ""}</span>
              <span class="t2-habit-name">${esc(h.name)}</span>
              ${typeof h.streak === "number" && h.streak > 0 ? `<span class="t2-habit-streak">${h.streak}d</span>` : ""}
            </button>`).join("") : `<div class="t2-empty slim">No routines yet.</div>`}
          </div>
        </section>

        <section class="t2-card">
          <div class="t2-sec-head"><span>Waiting on</span>${waiting && waiting.total ? `<em>${waiting.total}</em>` : ""}</div>
          ${waiting && waiting.total ? `<div class="t2-waiting">
            ${waiting.alert ? `<div class="t2-wait alert">${waiting.alert} overdue for a nudge</div>` : ""}
            ${waiting.stale ? `<div class="t2-wait stale">${waiting.stale} going quiet</div>` : ""}
            ${!waiting.alert && !waiting.stale ? `<div class="t2-wait ok">All moving — nothing to chase.</div>` : ""}
          </div>` : `<div class="t2-empty slim">Nothing on anyone else. Good.</div>`}
        </section>

        <section class="t2-card">
          <div class="t2-sec-head"><span>Reminders</span></div>
          ${(typeof remindersStrip === "function" ? remindersStrip() : "") || '<div class="t2-empty slim">Nothing scheduled.</div>'}
        </section>

        <section class="t2-card">
          <div class="t2-sec-head"><span>Tomorrow</span></div>
          ${(function () {
            const tom = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
            const t = open.filter((x) => x.dueAt && String(x.dueAt).slice(0, 10) === tom);
            return t.length ? `<div class="t2-tom">${t.slice(0, 3).map((x) => `<div class="t2-tom-row">${esc(x.title)}</div>`).join("")}</div>` : `<div class="t2-empty slim">Clear so far.</div>`;
          })()}
        </section>
      </aside>
    </div>

    <div class="t2-capture">
      <span class="t2-capture-ico">✎</span>
      <input id="t2-input" placeholder="Capture a task, note or idea — try “call sam friday p1 @work =20m”">
      <kbd>↵</kbd>
    </div>
  </div>`;

  // ── wiring ────────────────────────────────────────────────────────────────
  const inp = main.querySelector("#t2-input");
  wireAdd(inp);
  main.querySelector("#t2-capture").onclick = () => { if (inp) { inp.focus(); inp.scrollIntoView({ block: "nearest", behavior: "smooth" }); } toast("Type here — or press ⌥Space anywhere for quick capture"); };
  const planBtn = main.querySelector("#t2-plan"); if (planBtn) planBtn.onclick = () => { try { openMorningPlan(); } catch { gotoView("plan"); } };
  main.querySelectorAll("[data-habit]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    try { await window.donna.habitsToggle(b.dataset.habit); } catch {}
    await refresh(); vToday2();
  }));
  main.querySelectorAll("[data-done]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    completeWithAnim(b.dataset.done, b.closest(".t2-row"));
  }));
  main.querySelectorAll("[data-done3]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); completeWithAnim(b.dataset.done3, b.closest(".t2-up")); }));
  main.querySelectorAll("[data-up]").forEach((r) => (r.onclick = (e) => { if (!e.target.closest("button")) openTaskDetail(r.dataset.up); }));
  main.querySelectorAll("[data-open]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openTaskDetail(b.dataset.open); }));
  main.querySelectorAll(".t2-row").forEach((r) => (r.onclick = () => openTaskDetail(r.dataset.id)));
  main.querySelectorAll("[data-start2]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const t = open.find((x) => x.id === b.dataset.start2);
    const starting = !(t && t.status === "doing");
    if (starting && openDepIds(t || {}).length) { toast("Blocked — clear its dependencies first"); return; }
    await window.donna.setStatus(b.dataset.start2, starting ? "doing" : "todo");
    await refresh(); vToday2();
  }));
  main.querySelectorAll("[data-done2]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); completeWithAnim(b.dataset.done2, b.closest(".t2-block")); }));
  main.querySelectorAll(".t2-block").forEach((r) => (r.onclick = () => openTaskDetail(r.dataset.id)));
  main.querySelectorAll("[data-goto]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); gotoView(b.dataset.goto); }));
  const focus = main.querySelector("#t2-focus");
  if (focus) {
    const id = focus.dataset.id;
    focus.onclick = (e) => { if (!e.target.closest("button")) openTaskDetail(id); };
    main.querySelector("#t2-start").onclick = async (e) => {
      e.stopPropagation();
      const t = open.find((x) => x.id === id);
      const starting = !(t && t.status === "doing");
      if (starting && openDepIds(t || {}).length) { toast("Blocked — clear its dependencies first"); return; }
      await window.donna.setStatus(id, starting ? "doing" : "todo");
      await refresh(); vToday2();
    };
    main.querySelector("#t2-done").onclick = (e) => { e.stopPropagation(); completeWithAnim(id, main.querySelector("#t2-focus")); };
    main.querySelector("#t2-edit").onclick = (e) => { e.stopPropagation(); openTaskDetail(id); };
  }
  // live timer for the focused task
  const timerEl = main.querySelector("#t2-timer");
  if (timerEl && doing) {
    clearInterval(window.__t2timer);
    window.__t2timer = setInterval(() => {
      if (view !== "today" || !document.body.contains(timerEl)) { clearInterval(window.__t2timer); return; }
      timerEl.textContent = _t2elapsed(doing.startedAt);
    }, 1000);
  }
  try { applySections && applySections(); } catch {}
  openCoachButton("today", {
    open: data.counts.open, p1, overdue, doing: !!doing,
    hero: hero ? hero.title : null, routines: `${habitsDone}/${habits.length}`,
    blocked: open.filter((t) => openDepIds(t).length).length,
  });
}
