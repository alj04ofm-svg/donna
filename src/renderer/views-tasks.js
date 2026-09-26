/* Tasks — the engine of Donna.
   List · Board · Table, with freeform tags, blocked-by dependencies, bulk
   multi-select edits, saved views and reusable templates. Every other page
   (Today, Plan, Goals) reads from the same store, so this page is where the
   real work is shaped. Backend capability lives in src/lib/tasks-ext.js and is
   reached through window.donna.ext("tasks-ext", …). */

const isUntriaged = (t) => !t.bucket && !t.dueAt && t.status !== "doing" && !t.waitingOn && t.priority !== 1;

const TK_LS = {
  search: "donna.taskSearch", priority: "donna.taskFilterPriority",
  project: "donna.taskFilterProject", tag: "donna.taskFilterTag",
  due: "donna.dueFilter", sort: "donna.taskSort",
};
let taskSel = new Set();
let taskSelMode = false;
let _tfiltered = [];
let _tagIndex = [];
let _taskRefs = [];
let _views = [];
let _tpls = [];
let _handoffs = [];
let _lastSelId = null;

const AREAS = ["work", "money", "health", "relationships"];

/* ── filter state ─────────────────────────────────────────────────────────── */
function taskFilterState() {
  return {
    search: localStorage.getItem(TK_LS.search) || "",
    priority: localStorage.getItem(TK_LS.priority) || "",
    project: localStorage.getItem(TK_LS.project) || "",
    tag: localStorage.getItem(TK_LS.tag) || "",
    due: localStorage.getItem(TK_LS.due) || "",
    sort: localStorage.getItem(TK_LS.sort) || "priority",
    layout: taskLayout,
  };
}
function setFilter(key, value) {
  const ls = TK_LS[key];
  if (ls) { if (value) localStorage.setItem(ls, value); else localStorage.removeItem(ls); }
  else if (key === "layout") { taskLayout = value || "list"; localStorage.setItem("donna.taskLayout", taskLayout); }
}
function applyView(v) {
  const p = (v && v.payload) || {};
  for (const key of Object.keys(TK_LS)) setFilter(key, p[key] || "");
  if (p.layout) setFilter("layout", p.layout);
}
/* which saved view, if any, the current filters exactly equal — lets the
   select stay honest and the delete affordance appear only when meaningful */
function matchViewId() {
  const norm = (p) => JSON.stringify({
    search: p.search || "", priority: p.priority || "", project: p.project || "",
    tag: p.tag || "", due: p.due || "", sort: p.sort || "priority", layout: p.layout || "list",
  });
  const cur = norm(taskFilterState());
  const v = _views.find((x) => norm(x.payload || {}) === cur);
  return v ? v.id : "";
}
function dueBucketOk(t, due) {
  if (!due) return true;
  const iso = (t.dueAt || "").slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  if (due === "overdue") return !!iso && iso < today && t.status !== "doing";
  if (due === "today") return iso === today || t.bucket === "today" || t.priority === 1;
  if (due === "week") return !!iso && iso <= week;
  if (due === "none") return !iso;
  return iso === due;
}
function filterTasks(f) {
  let list = data.open.slice();
  if (f.search.trim()) {
    const q = f.search.toLowerCase();
    list = list.filter((t) => (t.title + " " + (t.detail || "") + " " + (t.tags || []).join(" ")).toLowerCase().includes(q));
  }
  if (f.priority) list = list.filter((t) => String(t.priority) === f.priority);
  if (f.project) list = list.filter((t) => (t.project_id || "") === f.project);
  if (f.tag) list = list.filter((t) => (t.tags || []).includes(f.tag));
  if (f.due) list = list.filter((t) => dueBucketOk(t, f.due));
  if (f.sort === "due") list.sort((a, b) => String(a.dueAt || "9999").localeCompare(String(b.dueAt || "9999")) || a.priority - b.priority);
  else if (f.sort === "newest") list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  else if (f.sort === "title") list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  else list.sort((a, b) => a.priority - b.priority || String(a.title).localeCompare(String(b.title)));
  return list;
}

const findTask = (id) => [...(data.open || []), ...(data.done || [])].find((x) => x.id === id);

async function tkRefresh(msg) {
  await refresh();
  if (view === "tasks") await vTasks(); else render();
  try { renderCompactBody(); } catch {}
  if (msg) toast(msg);
}

/* ── page ─────────────────────────────────────────────────────────────────── */
async function vTasks() {
  stagger = 0;
  const f = taskFilterState();
  const projects = [...new Set(data.open.map((t) => t.project_id).filter(Boolean))].sort();
  try { _tagIndex = await window.donna.ext("tasks-ext", "tagIndex"); } catch { _tagIndex = []; }
  try { _views = await window.donna.ext("tasks-ext", "viewsList"); } catch { _views = []; }
  try { _tpls = await window.donna.ext("tasks-ext", "templatesList"); } catch { _tpls = []; }
  try { _handoffs = await window.donna.waitingList(); } catch { _handoffs = []; }

  const untriaged = data.open.filter(isUntriaged);
  const anyFilter = f.search || f.priority || f.project || f.tag || f.due;
  const chips = [
    f.priority ? `<button class="tk-fchip" data-clear="priority">P${f.priority} <b>×</b></button>` : "",
    f.project ? `<button class="tk-fchip" data-clear="project">#${esc(f.project)} <b>×</b></button>` : "",
    f.tag ? `<button class="tk-fchip" data-clear="tag">+${esc(f.tag)} <b>×</b></button>` : "",
    f.due ? `<button class="tk-fchip" data-clear="due">${esc(f.due === "none" ? "no date" : f.due)} <b>×</b></button>` : "",
  ].join("");

  const viewOpts = _views.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("");
  main.innerHTML = `<div class="view wide tk-page">
    <header class="tk-head">
      <div>
        <h1 class="h1">Tasks</h1>
        <p class="tk-sub">${data.counts.open} open<span class="sep">·</span>${data.counts.p1} P1<span class="sep">·</span>${data.done.length} done<span class="sep">·</span>local to this Mac</p>
      </div>
      <div class="tk-head-acts">
        <div class="tk-views">
          <select id="tk-view-sel" class="tf-select" title="Saved views">
            <option value="">Views</option>${viewOpts}
          </select>
          <button class="tk-mini" id="tk-view-del" title="Delete this view" hidden>×</button>
          <span id="tk-view-save-wrap"><button class="tk-mini" id="tk-view-save" title="Save the current filters as a view">＋ View</button></span>
        </div>
        ${untriaged.length >= 3 ? `<button class="triage-btn" id="btn-triage">▤ Triage ${untriaged.length}</button>` : ""}
        <button class="triage-btn" id="btn-templates" title="New from a template"${_tpls.length ? "" : " hidden"}>▤ Templates</button>
        <button class="triage-btn primary" id="btn-newtask">＋ New task</button>
        <div class="seg">
          <button class="${taskLayout === "list" ? "on" : ""}" data-lay="list">List</button>
          <button class="${taskLayout === "board" ? "on" : ""}" data-lay="board">Board</button>
          <button class="${taskLayout === "table" ? "on" : ""}" data-lay="table">Table</button>
        </div>
      </div>
    </header>
    <div class="quick-add tasks-add"><input id="task-in" placeholder='New task — "email sam friday 3pm p1 #work +followup =2h" parses live'></div>
    <div class="tk-toolbar">
      <input id="tf-search" class="tf-search" placeholder="Search tasks…" value="${esc(f.search)}">
      <select id="tf-priority" class="tf-select"><option value="">Priority</option>${[1, 2, 3, 4].map((p) => `<option value="${p}"${f.priority === String(p) ? " selected" : ""}>P${p}</option>`).join("")}</select>
      <select id="tf-project" class="tf-select"><option value="">Project</option>${projects.map((p) => `<option value="${esc(p)}"${f.project === p ? " selected" : ""}>${esc(p)}</option>`).join("")}</select>
      <select id="tf-tag" class="tf-select"><option value="">Tag</option>${_tagIndex.map((x) => `<option value="${esc(x.tag)}"${f.tag === x.tag ? " selected" : ""}>${esc(x.tag)} · ${x.count}</option>`).join("")}</select>
      <select id="tf-due" class="tf-select"><option value="">Due</option>${[["overdue", "Overdue"], ["today", "Today"], ["week", "Next 7 days"], ["none", "No date"]].map(([v, l]) => `<option value="${v}"${f.due === v ? " selected" : ""}>${l}</option>`).join("")}</select>
      <select id="tf-sort" class="tf-select"><option value="">Sort</option>${[["priority", "Priority"], ["due", "Due date"], ["newest", "Newest"], ["title", "Title"]].map(([v, l]) => `<option value="${v}"${f.sort === v ? " selected" : ""}>${l}</option>`).join("")}</select>
      <span class="spacer"></span>
      ${anyFilter ? chips : ""}
      <button class="tk-mini ${taskSelMode ? "on" : ""}" id="tk-selectmode" title="Select multiple">☑ Select</button>
    </div>
    <div id="tk-bulk" hidden></div>
    <div id="task-body"></div>
  </div>`;

  wireAdd($("#task-in"));
  const search = $("#tf-search");
  search.oninput = () => {
    localStorage.setItem(TK_LS.search, search.value);
    paintTasksBody();
    const el = $("#tf-search"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  };
  $("#tf-priority").onchange = (e) => { setFilter("priority", e.target.value); vTasks(); };
  $("#tf-project").onchange = (e) => { setFilter("project", e.target.value); vTasks(); };
  $("#tf-tag").onchange = (e) => { setFilter("tag", e.target.value); vTasks(); };
  $("#tf-due").onchange = (e) => { setFilter("due", e.target.value); vTasks(); };
  $("#tf-sort").onchange = (e) => { setFilter("sort", e.target.value); vTasks(); };
  main.querySelectorAll("[data-clear]").forEach((b) => (b.onclick = () => { setFilter(b.dataset.clear, ""); vTasks(); }));
  const sm = $("#tk-selectmode");
  sm.onclick = () => { taskSelMode = !taskSelMode; if (!taskSelMode) taskSel.clear(); vTasks(); };

  const tb = $("#btn-triage"); if (tb) tb.onclick = () => openTriage(untriaged);
  const ntb = $("#btn-newtask"); if (ntb) ntb.onclick = () => openTaskDetail(null);
  const tpl = $("#btn-templates"); if (tpl) tpl.onclick = (e) => openTemplateMenu(e.currentTarget);
  main.querySelector(".seg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lay]"); if (!b) return;
    setFilter("layout", b.dataset.lay);
    vTasks();
  });

  /* saved views */
  const vs = $("#tk-view-sel");
  const matched = matchViewId();
  if (matched) { vs.value = matched; $("#tk-view-del").hidden = false; }
  vs.onchange = () => {
    const v = _views.find((x) => x.id === vs.value);
    $("#tk-view-del").hidden = !v;
    if (!v) return;
    applyView(v); vTasks();
  };
  $("#tk-view-del").onclick = async () => {
    const v = _views.find((x) => x.id === vs.value); if (!v) return;
    await window.donna.ext("tasks-ext", "viewRemove", v.id);
    setFilter("layout", taskFilterState().layout); vTasks(); toast("View removed");
  };
  $("#tk-view-save").onclick = () => {
    const wrap = $("#tk-view-save-wrap");
    wrap.innerHTML = `<input id="tk-view-name" class="tk-mini-input" placeholder="View name" autofocus>
      <button class="tk-mini" id="tk-view-ok">Save</button><button class="tk-mini" id="tk-view-cancel">Cancel</button>`;
    const inp = $("#tk-view-name"); inp.focus();
    const commit = async () => {
      const name = inp.value.trim(); if (!name) { inp.focus(); return; }
      await window.donna.ext("tasks-ext", "viewSave", name, taskFilterState());
      toast("View saved"); vTasks();
    };
    $("#tk-view-ok").onclick = commit;
    inp.onkeydown = (e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") vTasks(); };
    $("#tk-view-cancel").onclick = () => vTasks();
  };

  paintTasksBody();
  openCoachButton("tasks", {
    layout: taskLayout, open: data.counts.open, p1: data.counts.p1,
    overdue: data.open.filter((t) => t.dueAt && t.dueAt < new Date().toISOString().slice(0, 10) && t.status !== "doing").length,
    blocked: data.open.filter((t) => openDepIds(t).length).length,
    top3: data.open.slice(0, 3).map((t) => t.title),
  });
}

function paintTasksBody() {
  const body = $("#task-body"); if (!body) return;
  _tfiltered = filterTasks(taskFilterState());
  curList = _tfiltered;
  stagger = 0;
  if (taskLayout === "board") paintBoard(_tfiltered);
  else if (taskLayout === "table") paintTable(_tfiltered);
  else paintList(_tfiltered);
  paintBulkBar();
}

/* ── selection ────────────────────────────────────────────────────────────── */
window.__onTaskSelect = (id, e) => {
  if (e && e.shiftKey && _lastSelId) {
    const ids = _tfiltered.map((t) => t.id);
    const a = ids.indexOf(_lastSelId), b = ids.indexOf(id);
    if (a >= 0 && b >= 0) for (let i = Math.min(a, b); i <= Math.max(a, b); i++) taskSel.add(ids[i]);
    else taskSel.add(id);
  } else if (taskSel.has(id)) taskSel.delete(id);
  else taskSel.add(id);
  _lastSelId = id;
  paintTasksBody();
};

function paintBulkBar() {
  const el = $("#tk-bulk"); if (!el) return;
  const n = taskSel.size;
  if (!n) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  el.innerHTML = `<div class="tk-bulkbar">
    <span class="tk-bulkn">${n} selected</span>
    <button data-bulk="all" class="tk-bbtn">Select all</button>
    <button data-bulk="prio" class="tk-bbtn">Priority</button>
    <button data-bulk="due" class="tk-bbtn">Due</button>
    <button data-bulk="proj" class="tk-bbtn">Project</button>
    <button data-bulk="tag" class="tk-bbtn">＋ Tag</button>
    <button data-bulk="area" class="tk-bbtn">Area</button>
    <button data-bulk="done" class="tk-bbtn primary">Complete</button>
    <button data-bulk="del" class="tk-bbtn danger">Delete</button>
    <button data-bulk="clear" class="tk-bbtn ghost">Clear</button>
  </div>`;
  const ids = () => [...taskSel];
  el.querySelectorAll("[data-bulk]").forEach((b) => (b.onclick = async () => {
    const k = b.dataset.bulk;
    if (k === "clear") { taskSel.clear(); paintTasksBody(); return; }
    if (k === "all") { _tfiltered.forEach((t) => taskSel.add(t.id)); paintTasksBody(); return; }
    if (k === "done") { await window.donna.ext("tasks-ext", "bulkUpdate", ids(), { status: "done" }); taskSel.clear(); await tkRefresh(`${n} done`); return; }
    if (k === "del") {
      if (!confirm(`Delete ${n} task${n === 1 ? "" : "s"}? This can't be undone.`)) return;
      await window.donna.ext("tasks-ext", "deleteMany", ids()); taskSel.clear(); await tkRefresh("Deleted"); return;
    }
    if (k === "prio") { const v = await openMenu(b, [1, 2, 3, 4].map((p) => ({ label: `P${p}`, value: p }))); if (v == null) return; await window.donna.ext("tasks-ext", "bulkUpdate", ids(), { priority: v }); taskSel.clear(); await tkRefresh(`Set P${v}`); return; }
    if (k === "due") {
      const iso = (d) => d.toISOString().slice(0, 10);
      const t = new Date(), tom = new Date(Date.now() + 86400000), wk = new Date(Date.now() + 7 * 86400000);
      const v = await openMenu(b, [{ label: "Today", value: iso(t) }, { label: "Tomorrow", value: iso(tom) }, { label: "Next week", value: iso(wk) }, { label: "No date", value: null }]);
      if (v === undefined) return;
      await window.donna.ext("tasks-ext", "bulkUpdate", ids(), { dueAt: v }); taskSel.clear(); await tkRefresh("Rescheduled"); return;
    }
    if (k === "area") {
      const v = await openMenu(b, [{ label: "Work", value: "work" }, { label: "Money", value: "money" }, { label: "Health", value: "health" }, { label: "Relationships", value: "relationships" }, { label: "None", value: null }]);
      if (v === undefined) return;
      await window.donna.ext("tasks-ext", "bulkUpdate", ids(), { area: v }); taskSel.clear(); await tkRefresh("Area set"); return;
    }
    if (k === "proj") { const s = prompt("Project for selected tasks (blank clears):"); if (s === null) return; await window.donna.ext("tasks-ext", "bulkUpdate", ids(), { project_id: s.trim() || null }); taskSel.clear(); await tkRefresh("Project set"); return; }
    if (k === "tag") { const s = prompt("Tag to add:"); if (!s || !s.trim()) return; await window.donna.ext("tasks-ext", "bulkUpdate", ids(), { addTags: [s.trim()] }); taskSel.clear(); await tkRefresh("Tagged"); return; }
  }));
}

/* generic anchored menu — resolves to the chosen value, undefined on dismiss */
function openMenu(anchor, items) {
  return new Promise((resolve) => {
    const pop = document.createElement("div");
    pop.className = "pop tk-pop";
    pop.innerHTML = items.map((it, i) => `<button data-i="${i}">${esc(it.label)}${it.hint ? `<span>${esc(it.hint)}</span>` : ""}</button>`).join("");
    document.body.appendChild(pop);
    const r = pop.getBoundingClientRect(), a = anchor.getBoundingClientRect();
    pop.style.left = Math.min(a.left, window.innerWidth - r.width - 12) + "px";
    pop.style.top = Math.min(a.bottom + 6, window.innerHeight - r.height - 12) + "px";
    const done = (v) => { pop.remove(); document.removeEventListener("mousedown", h); resolve(v); };
    pop.querySelectorAll("button").forEach((btn) => (btn.onclick = () => done(items[+btn.dataset.i].value)));
    const h = (e) => { if (!pop.contains(e.target) && e.target !== anchor) done(undefined); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
  });
}

/* ── List (activation states, Things-style) ───────────────────────────────── */
function paintList(open) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const now = open.filter((t) => t.status === "doing");
  const waiting = open.filter((t) => t.status !== "doing" && t.waitingOn);
  const pool = open.filter((t) => t.status !== "doing" && !t.waitingOn);
  const someday = pool.filter((t) => t.bucket === "someday");
  const active = pool.filter((t) => t.bucket !== "someday");
  const evening = active.filter((t) => t.bucket === "evening" && (!t.dueAt || t.dueAt <= todayIso));
  const dayPool = active.filter((t) => !evening.includes(t));
  const todayList = dayPool.filter((t) => (t.dueAt && t.dueAt <= todayIso) || t.priority === 1 || t.bucket === "today");
  const week = dayPool.filter((t) => !todayList.includes(t) && t.dueAt && t.dueAt <= in7);
  const anytime = dayPool.filter((t) => !todayList.includes(t) && !week.includes(t));
  curList = [...now, ...todayList, ...evening, ...week, ...anytime, ...waiting, ...someday];
  let idx = 0;
  const rowFor = (t) => rowHtml(t, { idx: idx++, selectable: taskSelMode, selected: taskSel.has(t.id) });
  const sec = (label, list, cls = "") => list.length
    ? `<div class="sec ${cls}">${label} <b>${list.length}</b></div><div class="rows ${cls === "now-sec" ? "now-rows" : ""}">${list.map(rowFor).join("")}</div>` : "";
  const hoAge = (d) => d === 0 ? "today" : d === 1 ? "1 day" : `${d} days`;
  const waitCount = waiting.length + _handoffs.length;
  const logbook = [...data.done.slice().sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || ""))).slice(-5).map((t) => ({ ...t, _log: "done" })), ...(data.wontdo || []).slice().sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || ""))).slice(-3).map((t) => ({ ...t, _log: "wontdo" }))]
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt))).slice(-6).reverse();
  $("#task-body").innerHTML = `
    ${sec("Now", now, "now-sec")}
    ${sec("Today", todayList)}
    ${sec(`${MOON_SVG} This evening`, evening, "evening-sec")}
    ${sec("This week", week)}
    ${sec("Anytime", anytime)}
    ${waitCount ? `<div class="sec">Waiting on <b>${waitCount}</b></div>` : ""}
    ${waiting.length ? `<div class="rows">${waiting.map(rowFor).join("")}</div>` : ""}
    ${_handoffs.length ? `<div class="rows">${_handoffs.map((w) => `
      <div class="row wait-row ${w.stale ? "stale" : ""}">
        <span class="wait-age ${w.stale ? "stale" : ""}">${hoAge(w.days)}</span>
        <div class="row-body"><div class="row-title">${esc(w.item)}</div>
          <div class="wait-who">on ${esc(w.who || "someone")}${w.stale ? " · time to nudge" : ""}</div></div>
        <button class="wait-clear" data-hoclear="${w.id}">back to me</button>
      </div>`).join("")}</div>` : ""}
    <div class="quick-add" id="handoff-add-wrap"><input id="handoff-in" placeholder='Hand off to someone — "Invoice · Sam" ↵'></div>
    ${sec("Someday", someday, "someday-sec")}
    ${!open.length ? `<div class="rows"><div class="empty">${taskSelMode ? "Nothing to select." : `No tasks match. ${data.counts.doneToday ? data.counts.doneToday + " shipped today." : "Clean board."}`}</div></div>` : ""}
    ${logbook.length ? `<div class="sec">Logbook</div><div class="rows">${logbook.map((t) => `
      <div class="row"${si()}><div class="check ${t._log === "wontdo" ? "nixed" : "on"}">${t._log === "wontdo" ? "⊘" : CHECK_SVG}</div><div class="row-body"><div class="row-title" style="color:var(--dim)">${esc(t.title)}${t._log === "wontdo" && t.wontDoReason ? ` <span class="wontdo-why">· ${esc(t.wontDoReason)}</span>` : ""}</div></div></div>`).join("")}</div>` : ""}`;
  wireRows($("#task-body"));
  if (taskSelMode) $("#task-body").querySelectorAll(".row[data-id]").forEach((r) => (r.onclick = (e) => {
    if (e.target.closest("button, a, input")) return;
    window.__onTaskSelect(r.dataset.id, e);
  }));
  const hi = $("#handoff-in");
  if (hi) hi.onkeydown = async (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      const [item, who] = e.target.value.split(/[·|,]/).map((s) => s.trim());
      await window.donna.waitingAdd(item, who || "");
      e.target.value = ""; vTasks(); toast("Tracking it");
    }
  };
  $("#task-body").querySelectorAll("[data-hoclear]").forEach((b) => (b.onclick = async () => { await window.donna.waitingResolve(b.dataset.hoclear); vTasks(); toast("Back on you"); }));
}

/* ── Board: Now / Next / Done ─────────────────────────────────────────────── */
const COLS = [["now", "Now"], ["next", "Next"], ["done", "Done"]];
const colOf = (t) => t.status === "done" ? "done" : t.status === "doing" ? "now" : "next";
function cardHtml(t) {
  const col = colOf(t);
  return `<div class="card ${col === "done" ? "done" : ""} ${col === "now" ? "now" : ""}" data-id="${t.id}" data-colnow="${col}"${si()}>
    <div class="card-title">${esc(t.title)}</div>
    <div class="card-meta">${pGlyph(t.priority)}${col === "now" ? `<span class="chip now-chip">${elapsed(t.startedAt)}</span>` : ""}${tagChips(t, 2)}${depChip(t)}${t.waitingOn ? `<span class="chip wait">${esc(t.waitingOn)}</span>` : ""}${t.subtasks && t.subtasks.length ? `<span class="chip sub">${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</span>` : ""}${dueChip(t.dueAt)}</div>
  </div>`;
}
function paintBoard(open) {
  const all = [...open, ...data.done.slice(-5).reverse()];
  const by = (c) => all.filter((t) => colOf(t) === c);
  $("#task-body").innerHTML = `<div class="board">
    ${COLS.map(([key, label]) => {
      const cards = by(key);
      const wip = key === "now" && cards.length > 2;
      return `<div class="col" data-col="${key}">
        <div class="col-head">${label} <span class="n">${cards.length}</span>${wip ? '<span class="wip">one thing?</span>' : ""}</div>
        ${cards.map(cardHtml).join("") || '<div class="col-empty">Nothing here</div>'}
      </div>`;
    }).join("")}
  </div>`;
  wireBoard();
}
async function dropToCol(id, col) {
  if (col === "now") await window.donna.setStatus(id, "doing");
  else if (col === "done") await window.donna.setStatus(id, "done");
  else await window.donna.setStatus(id, "todo");
}
function wireBoard() {
  document.querySelectorAll("#task-body .card").forEach((card) => {
    card.addEventListener("dblclick", () => { if (typeof openTaskDetail === "function") openTaskDetail(card.dataset.id); });
    card.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const startX = e.clientX, startY = e.clientY;
      let clone = null;
      const id = card.dataset.id;
      const move = (ev) => {
        if (!clone && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
          clone = card.cloneNode(true);
          clone.id = "drag-clone";
          clone.style.setProperty("--w", card.getBoundingClientRect().width + "px");
          document.body.appendChild(clone);
          card.classList.add("ghost");
        }
        if (clone) {
          clone.style.left = ev.clientX - 30 + "px";
          clone.style.top = ev.clientY - 20 + "px";
          document.querySelectorAll(".col").forEach((c) => c.classList.remove("over"));
          const col = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".col");
          if (col) col.classList.add("over");
        }
      };
      const up = async (ev) => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (!clone) return;
        const col = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".col");
        clone.remove();
        card.classList.remove("ghost");
        document.querySelectorAll(".col").forEach((c) => c.classList.remove("over"));
        if (col && col.dataset.col !== card.dataset.colnow) {
          await dropToCol(id, col.dataset.col);
          await refresh();
          if (view === "tasks") vTasks();
          try { renderCompactBody(); } catch {}
          toast(col.dataset.col === "done" ? "Done" : col.dataset.col === "now" ? "On it" : "Moved");
        }
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
  });
}

/* ── Table: ClickUp-style grid with inline status + bulk select ───────────── */
function paintTable(open) {
  const all = [...open, ...data.done.slice(-8).reverse()];
  const allSelected = all.length > 0 && all.every((t) => taskSel.has(t.id));
  $("#task-body").innerHTML = `<div class="ttable">
    <div class="tt-head">
      <span class="tt-c-sel"><button class="check sel ${allSelected ? "on" : ""}" id="tt-all" title="Select all">${allSelected ? CHECK_SVG : ""}</button></span>
      <span class="tt-c-name">Name</span><span>Tags</span><span>Priority</span><span>Due</span><span>Project</span><span>Status</span><span>Deps</span>
    </div>
    <div class="tt-body">
      ${all.length ? all.map((t) => {
        const st = t.status === "done" ? (t.wontDo ? "Won't do" : "Done") : colOf(t) === "now" ? "In progress" : "To do";
        const deps = openDepIds(t).length;
        return `<div class="tt-row ${taskSel.has(t.id) ? "sel" : ""}" data-tt="${t.id}">
          <span class="tt-c-sel"><button class="check sel ${taskSel.has(t.id) ? "on" : ""}" data-sel="${t.id}" aria-label="Select">${taskSel.has(t.id) ? CHECK_SVG : ""}</button></span>
          <span class="tt-c-name"><span class="tt-title">${esc(t.title)}</span>${t.subtasks && t.subtasks.length ? `<span class="chip sub">${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</span>` : ""}</span>
          <span class="tt-tags">${tagChips(t, 2) || "—"}</span>
          <span class="tt-cell" data-ttprio="${t.id}" title="Click to cycle priority">${pGlyph(t.priority)}</span>
          <span class="tt-cell" data-ttdue="${t.id}" title="Click to reschedule">${t.dueAt ? esc(String(t.dueAt).slice(0, 10)) : "—"}</span>
          <span>${esc(t.project_id || "—")}</span>
          <span class="tt-status ${t.status === "done" ? "done" : colOf(t) === "now" ? "now" : ""}" data-ttstatus="${t.id}" title="Click to cycle status">${st}</span>
          <span>${deps ? `<span class="chip blocked">⛓ ${deps}</span>` : "—"}</span>
        </div>`;
      }).join("") : `<div class="empty" style="padding:18px">No tasks.</div>`}
    </div>
  </div>`;
  const allBtn = $("#tt-all");
  if (allBtn) allBtn.onclick = () => {
    if (allSelected) all.forEach((t) => taskSel.delete(t.id));
    else all.forEach((t) => taskSel.add(t.id));
    paintTasksBody();
  };
  $("#task-body").querySelectorAll("[data-sel]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); window.__onTaskSelect(el.dataset.sel, e); }));
  $("#task-body").querySelectorAll("[data-ttprio]").forEach((el) => (el.onclick = async (e) => {
    e.stopPropagation();
    const t = findTask(el.dataset.ttprio); if (!t) return;
    const next = t.priority >= 4 ? 1 : t.priority + 1;
    await window.donna.setPriority(t.id, next);
    await tkRefresh(`P${next}`);
  }));
  $("#task-body").querySelectorAll("[data-ttdue]").forEach((el) => (el.onclick = (e) => {
    e.stopPropagation();
    openSnooze(el.dataset.ttdue, el.getBoundingClientRect());
  }));
  $("#task-body").querySelectorAll("[data-ttstatus]").forEach((el) => (el.onclick = async (e) => {
    e.stopPropagation();
    const t = findTask(el.dataset.ttstatus); if (!t) return;
    const next = t.status === "doing" ? "done" : t.status === "done" ? "todo" : "doing";
    await window.donna.setStatus(t.id, next);
    await tkRefresh(next === "done" ? "Done" : next === "doing" ? "On it" : "To do");
  }));
  $("#task-body").querySelectorAll("[data-tt]").forEach((r) => (r.onclick = (e) => {
    if (e.target.closest("[data-sel], [data-ttprio], [data-ttdue], [data-ttstatus]")) return;
    openTaskDetail(r.dataset.tt);
  }));
}

/* ── templates menu ───────────────────────────────────────────────────────── */
async function openTemplateMenu(anchor) {
  const items = _tpls.map((t) => ({ label: t.name, hint: t.title && t.title !== t.name ? trunc(t.title, 28) : "", value: t.id }));
  if (!items.length) { toast("No templates yet — save one from a task"); return; }
  const id = await openMenu(anchor, items);
  if (!id) return;
  const r = await window.donna.ext("tasks-ext", "templateInstantiate", id);
  if (r && r.ok) { await tkRefresh("Created from template"); openTaskDetail(r.id); }
}

/* ── Task composer / detail ───────────────────────────────────────────────── */
async function openTaskDetail(id) {
  const existing = id ? findTask(id) : null;
  const isNew = !existing;
  const t = existing || { id: null, title: "", detail: "", status: "todo", priority: 2, dueAt: null, dueTime: null, deadline: null, deadlineHard: false, project_id: "", assignee: "", area: null, tags: [], dependsOn: [], subtasks: [], recurrence: null, estimatedMinutes: null, objectiveId: null };
  let people = [], goals = [];
  try { people = await window.donna.peopleList(); } catch {}
  try { goals = await window.donna.goalsList(); } catch {}
  try { _taskRefs = await window.donna.ext("tasks-ext", "allRefs"); } catch { _taskRefs = []; }
  let subs = (Array.isArray(t.subtasks) ? t.subtasks : []).map((x) => ({ ...x }));
  let tags = (Array.isArray(t.tags) ? t.tags : []).slice();
  let deps = (Array.isArray(t.dependsOn) ? t.dependsOn : []).slice();
  const projList = [...new Set([...(data.open || []), ...(data.done || [])].map((x) => x.project_id).filter(Boolean))];

  const el = document.createElement("div");
  el.id = "task-detail-ov";
  el.className = "tk-ov";
  el.innerHTML = `<div class="tk-panel" role="dialog" aria-label="${isNew ? "New task" : "Task"}">
    <div class="tk-panel-head">
      <span class="tk-panel-title">${isNew ? "New task" : "Task"}</span>
      <span class="spacer"></span>
      ${isNew && _tpls.length ? `<select id="td-template" class="tk-inline-sel"><option value="">Start from template…</option>${_tpls.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select>` : ""}
      <button id="td-close" class="icon-btn" title="Close (esc)">×</button>
    </div>
    <input id="td-title" class="tk-input tk-title-input" value="${esc(t.title)}" placeholder="Task title">
    <textarea id="td-notes" class="tk-input tk-notes" rows="3" placeholder="Notes, links, context…">${esc(t.detail || "")}</textarea>
    <div class="tk-grid">
      <label class="tk-field"><span>Status</span>
        <select id="td-status" class="tk-input">
          <option value="todo"${t.status === "todo" ? " selected" : ""}>To do</option>
          <option value="doing"${t.status === "doing" ? " selected" : ""}>In progress</option>
          <option value="done"${t.status === "done" ? " selected" : ""}>Done</option>
        </select></label>
      <label class="tk-field"><span>Priority</span>
        <select id="td-priority" class="tk-input">${[1, 2, 3, 4].map((p) => `<option value="${p}"${t.priority === p ? " selected" : ""}>P${p}</option>`).join("")}</select></label>
      <label class="tk-field"><span>Due</span><input id="td-due" type="date" class="tk-input" value="${t.dueAt ? String(t.dueAt).slice(0, 10) : ""}"></label>
      <label class="tk-field"><span>Time</span><input id="td-duetime" type="time" class="tk-input" value="${esc(t.dueTime || "")}"></label>
      <label class="tk-field"><span>Deadline</span><input id="td-deadline" type="date" class="tk-input" value="${t.deadline ? String(t.deadline).slice(0, 10) : ""}"></label>
      <label class="tk-field"><span>Project</span><input id="td-project" class="tk-input" list="td-projects" value="${esc(t.project_id || "")}" placeholder="e.g. work"><datalist id="td-projects">${projList.map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist></label>
      <label class="tk-field"><span>Area</span>
        <select id="td-area" class="tk-input"><option value="">None</option>${AREAS.map((a) => `<option value="${a}"${t.area === a ? " selected" : ""}>${a[0].toUpperCase() + a.slice(1)}</option>`).join("")}</select></label>
      <label class="tk-field"><span>Assignee</span><input id="td-assignee" class="tk-input" list="td-people" value="${esc(t.assignee || "")}" placeholder="me"><datalist id="td-people">${people.map((p) => `<option value="${esc(p.name)}"></option>`).join("")}</datalist></label>
      <label class="tk-field"><span>Estimate (min)</span><input id="td-est" type="number" min="0" class="tk-input" value="${t.estimatedMinutes || ""}" placeholder="30"></label>
      <label class="tk-field"><span>Repeats</span>
        <select id="td-recur" class="tk-input">
          <option value="">Never</option>
          ${[["daily", "Daily"], ["weekdays", "Weekdays"], ["weekly", "Weekly"]].map(([v, l]) => `<option value="${v}"${(t.recurrence && t.recurrence.freq === v) ? " selected" : ""}>${l}</option>`).join("")}
        </select></label>
      <label class="tk-field tk-span2"><span>Goal</span>
        <select id="td-goal" class="tk-input"><option value="">Not linked</option>${goals.map((g) => `<option value="${esc(g.id)}"${t.objectiveId === g.id ? " selected" : ""}>${esc(g.title || g.objective || "(goal)")}</option>`).join("")}</select></label>
    </div>

    <div class="tk-sect">
      <div class="tk-sect-h">Tags</div>
      <div class="tk-chips" id="td-tags"></div>
      <input id="td-tag-in" class="tk-input tk-inline-input" list="td-tag-list" placeholder="Add a tag and press ↵">
      <datalist id="td-tag-list">${(_tagIndex || []).map((x) => `<option value="${esc(x.tag)}"></option>`).join("")}</datalist>
    </div>

    <div class="tk-sect">
      <div class="tk-sect-h">Blocked by</div>
      <div class="tk-chips" id="td-deps"></div>
      <input id="td-dep-in" class="tk-input tk-inline-input" list="td-dep-list" placeholder="Search open tasks and press ↵">
      <datalist id="td-dep-list"></datalist>
    </div>

    <div class="tk-sect">
      <div class="tk-sect-h">Subtasks</div>
      <div id="td-subs"></div>
      <input id="td-sub-in" class="tk-input tk-inline-input" placeholder="Add a subtask and press ↵">
    </div>

    <div class="tk-panel-actions">
      ${isNew ? "" : `<button id="td-dup" class="tk-btn">Duplicate</button>
      <button id="td-tpl" class="tk-btn">Save as template</button>
      <button id="td-wont" class="tk-btn">Won't do</button>
      <button id="td-del" class="tk-btn danger">Delete</button>`}
      <span class="spacer"></span>
      <button id="td-cancel" class="tk-btn ghost">Cancel</button>
      <button id="td-save" class="tk-btn primary">${isNew ? "Add task" : "Save"}</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  let onKey = null;
  const close = () => { el.remove(); if (onKey) document.removeEventListener("keydown", onKey, true); };
  el.addEventListener("mousedown", (e) => { if (e.target === el) close(); });
  el.querySelector("#td-close").onclick = close;
  el.querySelector("#td-cancel").onclick = close;
  onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  document.addEventListener("keydown", onKey, true);

  const titleInp = el.querySelector("#td-title");
  titleInp.focus(); titleInp.setSelectionRange(titleInp.value.length, titleInp.value.length);
  const tplSel = el.querySelector("#td-template");
  if (tplSel) tplSel.onchange = async (e) => {
    if (!e.target.value) return;
    const r = await window.donna.ext("tasks-ext", "templateInstantiate", e.target.value);
    if (r && r.ok) { close(); await refresh(); openTaskDetail(r.id); toast("Created from template"); }
  };

  /* tags editor */
  const tagsWrap = el.querySelector("#td-tags");
  const renderTags = () => {
    tagsWrap.innerHTML = tags.length ? tags.map((x, i) => `<span class="tkc-tag" style="--h:${tagHue(x)}">${esc(x)}<button data-trm="${i}" aria-label="Remove">×</button></span>`).join("") : '<span class="tk-mut">No tags</span>';
    tagsWrap.querySelectorAll("[data-trm]").forEach((b) => (b.onclick = () => { tags.splice(+b.dataset.trm, 1); renderTags(); }));
  };
  renderTags();
  const tagInp = el.querySelector("#td-tag-in");
  tagInp.onkeydown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = tagInp.value.trim().replace(/^\+/, "").toLowerCase().replace(/\s+/g, "-");
    if (v && !tags.includes(v) && tags.length < 12) tags.push(v);
    tagInp.value = ""; renderTags();
  };

  /* dependencies editor */
  const depsWrap = el.querySelector("#td-deps");
  const depList = el.querySelector("#td-dep-list");
  const renderDeps = () => {
    const chosen = deps.map((did) => _taskRefs.find((r) => r.id === did) || { id: did, title: "(done or removed)" });
    depsWrap.innerHTML = chosen.length ? chosen.map((r, i) => `<span class="tk-dep">⛓ ${esc(trunc(r.title, 30))}<button data-drm="${i}" aria-label="Remove">×</button></span>`).join("") : '<span class="tk-mut">Nothing — free to start</span>';
    depsWrap.querySelectorAll("[data-drm]").forEach((b) => (b.onclick = () => { deps.splice(+b.dataset.drm, 1); renderDeps(); }));
    const avail = _taskRefs.filter((r) => r.id !== id && !deps.includes(r.id));
    depList.innerHTML = avail.map((r) => `<option value="${esc(r.title)}"></option>`).join("");
  };
  renderDeps();
  const depInp = el.querySelector("#td-dep-in");
  depInp.onkeydown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = depInp.value.trim().toLowerCase(); if (!q) return;
    const match = _taskRefs.find((r) => r.id !== id && !deps.includes(r.id) && r.title.toLowerCase() === q) || _taskRefs.find((r) => r.id !== id && !deps.includes(r.id) && r.title.toLowerCase().includes(q));
    if (match) deps.push(match.id);
    depInp.value = ""; renderDeps();
  };

  /* subtasks editor */
  const subsWrap = el.querySelector("#td-subs");
  const renderSubs = () => {
    subsWrap.innerHTML = subs.length ? subs.map((x, i) => `
      <div class="tk-sub">
        <button class="check sel ${x.done ? "on" : ""}" data-subtoggle="${i}">${x.done ? CHECK_SVG : ""}</button>
        <span class="tk-sub-text ${x.done ? "done" : ""}">${esc(x.text)}</span>
        <button class="tk-x" data-subrm="${i}" aria-label="Remove">×</button>
      </div>`).join("") : '<span class="tk-mut">No subtasks</span>';
    subsWrap.querySelectorAll("[data-subtoggle]").forEach((b) => (b.onclick = () => { const i = +b.dataset.subtoggle; subs[i].done = !subs[i].done; renderSubs(); }));
    subsWrap.querySelectorAll("[data-subrm]").forEach((b) => (b.onclick = () => { subs.splice(+b.dataset.subrm, 1); renderSubs(); }));
  };
  renderSubs();
  const subInp = el.querySelector("#td-sub-in");
  subInp.onkeydown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = subInp.value.trim(); if (!v) return;
    subs.push({ id: `s_${Date.now()}`, text: v, done: false });
    subInp.value = ""; renderSubs();
  };

  const after = async (msg) => { close(); await refresh(); if (view === "tasks") vTasks(); try { renderCompactBody(); } catch {} if (msg) toast(msg); };

  el.querySelector("#td-save").onclick = async () => {
    const title = titleInp.value.trim();
    if (!title) { titleInp.focus(); return; }
    const prio = Number(el.querySelector("#td-priority").value);
    const due = el.querySelector("#td-due").value || null;
    const fields = {
      detail: el.querySelector("#td-notes").value,
      dueTime: el.querySelector("#td-duetime").value || null,
      deadline: el.querySelector("#td-deadline").value || null,
      deadlineHard: !!el.querySelector("#td-deadline").value,
      project_id: el.querySelector("#td-project").value.trim() || null,
      area: el.querySelector("#td-area").value || null,
      assignee: el.querySelector("#td-assignee").value.trim() || null,
      estimatedMinutes: el.querySelector("#td-est").value ? Number(el.querySelector("#td-est").value) : null,
      recurrence: el.querySelector("#td-recur").value ? { freq: el.querySelector("#td-recur").value } : null,
      objectiveId: el.querySelector("#td-goal").value || null,
      subtasks: subs,
    };
    let target = id;
    if (isNew) target = await window.donna.addTask(title);
    await window.donna.setTaskField(target, "title", title);
    for (const [k, v] of Object.entries(fields)) await window.donna.setTaskField(target, k, v);
    await window.donna.setTaskField(target, "tags", tags);
    await window.donna.setPriority(target, prio);
    await window.donna.setDue(target, due);
    const st = el.querySelector("#td-status").value;
    if (isNew || st !== t.status) await window.donna.setStatus(target, st);
    const depRes = await window.donna.ext("tasks-ext", "setDeps", target, deps);
    if (depRes && depRes.ok === false) toast(depRes.error || "Couldn't save dependencies");
    await after(isNew ? "Added" : "Saved");
  };
  const delBtn = el.querySelector("#td-del"); if (delBtn) delBtn.onclick = async () => { if (!confirm("Delete this task?")) return; await window.donna.removeTask(id); await after("Deleted"); };
  const dupBtn = el.querySelector("#td-dup"); if (dupBtn) dupBtn.onclick = async () => { const nid = await window.donna.ext("tasks-ext", "duplicate", id); await after(nid ? "Duplicated" : "Couldn't duplicate"); };
  const wontBtn = el.querySelector("#td-wont"); if (wontBtn) wontBtn.onclick = async () => { await window.donna.setWontDo(id, "not this time"); await after("Marked won't do"); };
  const tplBtn = el.querySelector("#td-tpl"); if (tplBtn) tplBtn.onclick = async () => {
    const name = prompt("Template name:", title.slice(0, 40)); if (!name) return;
    await window.donna.ext("tasks-ext", "templateSaveFromTask", id, name);
    toast("Template saved");
  };
}
