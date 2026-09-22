/* a task is untriaged when it has no activation state at all — no bucket, no
   date, not being worked, not parked on someone. These feed the triage wizard. */
const isUntriaged = (t) => !t.bucket && !t.dueAt && t.status !== "doing" && !t.waitingOn && t.priority !== 1;

async function vTasks() {
  stagger = 0;
  const dueFilter = localStorage.getItem("donna.dueFilter");
  const search = localStorage.getItem("donna.taskSearch") || "";
  const fPr = localStorage.getItem("donna.taskFilterPriority") || "";
  const fProj = localStorage.getItem("donna.taskFilterProject") || "";
  const sort = localStorage.getItem("donna.taskSort") || "priority";
  let allOpen = data.open.slice();
  if (dueFilter) allOpen = allOpen.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === dueFilter);
  if (search.trim()) { const q = search.toLowerCase(); allOpen = allOpen.filter((t) => (t.title + " " + (t.detail || "")).toLowerCase().includes(q)); }
  if (fPr) allOpen = allOpen.filter((t) => String(t.priority) === fPr);
  if (fProj) allOpen = allOpen.filter((t) => (t.project_id || "") === fProj);
  if (sort === "due") allOpen.sort((a, b) => String(a.dueAt || "9999").localeCompare(String(b.dueAt || "9999")) || a.priority - b.priority);
  else if (sort === "newest") allOpen.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  else allOpen.sort((a, b) => a.priority - b.priority);
  const projects = [...new Set(data.open.map((t) => t.project_id).filter(Boolean))].sort();
  const open = allOpen;
  curList = open;
  const untriaged = open.filter(isUntriaged);
  const handoffs = await window.donna.waitingList();
  const filterChip = dueFilter ? `<div class="tasks-filter-chip">${esc(dueFilter)}<button class="tasks-filter-x" id="tasks-filter-clear">×</button></div>` : "";
  const segHtml = `<div class="seg">
    <button class="${taskLayout === "list" ? "on" : ""}" data-lay="list">List</button>
    <button class="${taskLayout === "board" ? "on" : ""}" data-lay="board">Board</button>
    <button class="${taskLayout === "table" ? "on" : ""}" data-lay="table">Table</button>
    <button class="${taskLayout === "projects" ? "on" : ""}" data-lay="projects">By project</button>
  </div>`;
  main.innerHTML = `<div class="view wide">
    <div class="tasks-topbar">
      <div class="tasks-head">
        <div><h1 class="h1">Tasks</h1>
        <p class="sub">${data.counts.open} open<span class="sep">·</span>${data.done.length} done<span class="sep">·</span>kept on this Mac${dueFilter ? `<span class="sep">·</span>filtering to ${esc(dueFilter)}` : ""}</p></div>
        <div class="tasks-head-acts">
          ${filterChip}
          <button class="triage-btn" id="btn-newtask">＋ New task</button>
          ${untriaged.length >= 3 ? `<button class="triage-btn" id="btn-triage">▤ Triage ${untriaged.length}</button>` : ""}
          ${segHtml}
        </div>
      </div>
      <div class="quick-add tasks-add"><input id="task-in" placeholder='New task — "email sam friday 3pm p1 #work @work =2h" parses live'></div>
      <div class="task-filters">
        <input id="tf-search" class="tf-search" placeholder="Search…" value="${esc(search)}">
        <select id="tf-priority" class="tf-select">
          <option value="">All priorities</option>
          ${[1, 2, 3, 4].map((p) => `<option value="${p}"${fPr === String(p) ? " selected" : ""}>P${p}</option>`).join("")}
        </select>
        <select id="tf-project" class="tf-select">
          <option value="">All projects</option>
          ${projects.map((p) => `<option value="${esc(p)}"${fProj === p ? " selected" : ""}>${esc(p)}</option>`).join("")}
        </select>
        <select id="tf-sort" class="tf-select">
          <option value="priority"${sort === "priority" ? " selected" : ""}>Sort: Priority</option>
          <option value="due"${sort === "due" ? " selected" : ""}>Sort: Due date</option>
          <option value="newest"${sort === "newest" ? " selected" : ""}>Sort: Newest</option>
        </select>
      </div>
    </div>
    <div id="task-body"></div>
  </div>`;
  wireAdd($("#task-in"));
  const tfSearch = $("#tf-search");
  tfSearch.oninput = () => { localStorage.setItem("donna.taskSearch", tfSearch.value); vTasks(); const el = $("#tf-search"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
  $("#tf-priority").onchange = (e) => { localStorage.setItem("donna.taskFilterPriority", e.target.value); vTasks(); };
  $("#tf-project").onchange = (e) => { localStorage.setItem("donna.taskFilterProject", e.target.value); vTasks(); };
  $("#tf-sort").onchange = (e) => { localStorage.setItem("donna.taskSort", e.target.value); vTasks(); };
  const tb = $("#btn-triage"); if (tb) tb.onclick = () => openTriage(untriaged);
  const ntb = $("#btn-newtask"); if (ntb) ntb.onclick = () => openTaskDetail(null);
  if (!window.__donnaNewTaskKey) {
    window.__donnaNewTaskKey = true;
    document.addEventListener("keydown", (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (view === "tasks" && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "n" && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
        e.preventDefault();
        openTaskDetail(null);
      }
    });
  }
  const tc = $("#tasks-filter-clear"); if (tc) tc.onclick = () => { localStorage.removeItem("donna.dueFilter"); vTasks(); };
  $("#main .seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    taskLayout = b.dataset.lay;
    localStorage.setItem("donna.taskLayout", taskLayout);
    vTasks();
  });
  taskLayout === "board" ? paintBoard(open)
    : taskLayout === "table" ? paintTable(open)
    : taskLayout === "projects" ? paintProjects(open)
    : paintList(open, handoffs);
  openCoachButton("tasks", {
    layout: taskLayout, open: open.length, p1: data.counts.p1,
    overdue: open.filter((t) => t.dueAt && t.dueAt < new Date().toISOString().slice(0, 10) && t.status !== "doing").length,
    waiting: open.filter((t) => t.waitingOn).length,
    top3: open.slice(0, 3).map((t) => t.title),
  });
}

/* activation states (Things), not team status columns:
   Now → Today → This Evening → This week → Anytime → Someday → Waiting.
   Someday is parked — visible here, excluded from every count and plan. */
function paintList(open, handoffs = []) {
  stagger = 0;
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
  const sec = (label, list, cls = "") => list.length
    ? `<div class="sec ${cls}">${label} <b>${list.length}</b></div><div class="rows ${cls === "now-sec" ? "now-rows" : ""}">${list.map((t) => rowHtml(t, { idx: idx++ })).join("")}</div>` : "";
  const hoAge = (d) => d === 0 ? "today" : d === 1 ? "1 day" : `${d} days`;
  const waitCount = waiting.length + handoffs.length;
  const logbook = [...data.done.slice(-5).map((t) => ({ ...t, _log: "done" })), ...(data.wontdo || []).slice(-3).map((t) => ({ ...t, _log: "wontdo" }))]
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt))).slice(-6).reverse();
  $("#task-body").innerHTML = `
    ${sec("Now", now, "now-sec")}
    ${sec("Today", todayList)}
    ${sec(`${MOON_SVG} This evening`, evening, "evening-sec")}
    ${sec("This week", week)}
    ${sec("Anytime", anytime)}
    ${waitCount || waiting.length ? `<div class="sec">Waiting on <b>${waitCount}</b></div>` : ""}
    ${waiting.length ? `<div class="rows">${waiting.map((t) => rowHtml(t, { idx: idx++ })).join("")}</div>` : ""}
    ${handoffs.length ? `<div class="rows">${handoffs.map((w) => `
      <div class="row wait-row ${w.stale ? "stale" : ""}">
        <span class="wait-age ${w.stale ? "stale" : ""}">${hoAge(w.days)}</span>
        <div class="row-body"><div class="row-title">${esc(w.item)}</div>
          <div class="wait-who">on ${esc(w.who || "someone")}${w.stale ? " · time to nudge" : ""}</div></div>
        <button class="wait-clear" data-hoclear="${w.id}">back to me</button>
      </div>`).join("")}</div>` : ""}
    <div class="quick-add" id="handoff-add-wrap" style="margin:0 0 4px"><input id="handoff-in" placeholder='Hand off to someone — "Invoice · Sam" ↵'></div>
    ${sec("Someday", someday, "someday-sec")}
    ${!open.length ? `<div class="rows"><div class="empty">No open tasks. <b>${data.counts.doneToday ? data.counts.doneToday + " shipped today." : "Clean board."}</b></div></div>` : ""}
    ${logbook.length ? `<div class="sec">Logbook</div><div class="rows">${logbook.map((t) => `
      <div class="row"${si()}><div class="check ${t._log === "wontdo" ? "nixed" : "on"}">${t._log === "wontdo" ? "⊘" : CHECK_SVG}</div><div class="row-body"><div class="row-title" style="color:var(--dim)">${esc(t.title)}${t._log === "wontdo" && t.wontDoReason ? ` <span class="wontdo-why">· ${esc(t.wontDoReason)}</span>` : ""}</div></div></div>`).join("")}</div>` : ""}`;
  wireRows($("#task-body"));
  $("#handoff-in").onkeydown = async (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      const [item, who] = e.target.value.split(/[·|,]/).map((s) => s.trim());
      await window.donna.waitingAdd(item, who || "");
      e.target.value = ""; vTasks(); toast("Tracking it");
    }
  };
  $("#task-body").querySelectorAll("[data-hoclear]").forEach((b) => (b.onclick = async () => { await window.donna.waitingResolve(b.dataset.hoclear); vTasks(); toast("Back on you"); }));
}

/* ── personal board: Now / Next / Done — flow state, not team lanes.
   waiting tasks fold into Next carrying their person-chip (no 4th column). ── */
const COLS = [["now", "Now"], ["next", "Next"], ["done", "Done"]];
const colOf = (t) => t.status === "done" ? "done" : t.status === "doing" ? "now" : "next";
function cardHtml(t) {
  const col = colOf(t);
  return `<div class="card ${col === "done" ? "done" : ""} ${col === "now" ? "now" : ""}" data-id="${t.id}" data-colnow="${col}"${si()}>
    <div class="card-title">${esc(t.title)}</div>
    <div class="card-meta">${pGlyph(t.priority)}${col === "now" ? `<span class="chip now-chip">${elapsed(t.startedAt)}</span>` : ""}${t.assignee && t.assignee !== "me" ? `<span class="chip who">@${esc(t.assignee)}</span>` : ""}${t.waitingOn ? `<span class="chip wait">${esc(t.waitingOn)}</span>` : ""}${t.subtasks && t.subtasks.length ? `<span class="chip sub">${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</span>` : ""}${dueChip(t.dueAt)}</div>
  </div>`;
}
/* Table view — ClickUp-style columns: Name · Priority · Due · Project ·
   Assignee · Status. Click a row to edit; the checkbox completes. */
function paintTable(open) {
  stagger = 0;
  const all = [...open, ...data.done.slice(-8).reverse()];
  $("#task-body").innerHTML = `<div class="ttable">
    <div class="tt-head">
      <span class="tt-c-name">Name</span><span>Priority</span><span>Due</span><span>Project</span><span>Assignee</span><span>Status</span>
    </div>
    <div class="tt-body">
      ${all.length ? all.map((t) => {
        const st = t.status === "done" ? "done" : colOf(t) === "now" ? "In progress" : "To do";
        return `<div class="tt-row" data-tt="${t.id}">
          <span class="tt-c-name">
            <button class="check ${t.status === "done" ? "on" : ""}" data-ttdone="${t.id}" aria-label="Complete">${CHECK_SVG}</button>
            <span class="tt-title">${esc(t.title)}</span>
            ${t.subtasks && t.subtasks.length ? `<span class="chip sub">${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</span>` : ""}
          </span>
          <span>${pGlyph(t.priority)}</span>
          <span>${t.dueAt ? esc(String(t.dueAt).slice(0, 10)) : "—"}</span>
          <span>${esc(t.project_id || "—")}</span>
          <span>${esc(t.assignee || "me")}</span>
          <span class="tt-status ${t.status === "done" ? "done" : colOf(t) === "now" ? "now" : ""}">${st}</span>
        </div>`;
      }).join("") : `<div class="empty" style="padding:18px">No tasks.</div>`}
    </div>
  </div>`;
  $("#task-body").querySelectorAll("[data-ttdone]").forEach((el) => (el.onclick = (e) => {
    e.stopPropagation();
    completeWithAnim(el.dataset.ttdone, el.closest(".tt-row"));
  }));
  $("#task-body").querySelectorAll("[data-tt]").forEach((r) => (r.onclick = (e) => {
    if (e.target.closest("[data-ttdone]")) return;
    openTaskDetail(r.dataset.tt);
  }));
}

function paintBoard(open) {
  stagger = 0;
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
  else { await window.donna.setStatus(id, "todo"); } // Next — leave any waiting flag intact
}
function wireBoard() {
  document.querySelectorAll(".card").forEach((card) => {
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
          renderCompactBody();
          toast(col.dataset.col === "done" ? "Done" : col.dataset.col === "now" ? "On it" : `Moved to ${col.dataset.col}`);
        }
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
  });
}

/* Project Kanban — read-only Trello-style board. One column per
   project_id, cards are open tasks in that project. Click a card to
   start focus; right-click to open the full task in Tasks list. */
function paintProjects(open) {
  const all = [...open, ...data.done.slice(-6).reverse()];
  const projects = {};
  for (const t of all) (projects[t.project_id || "no-project"] = projects[t.project_id || "no-project"] || []).push(t);
  const sorted = Object.entries(projects).sort((a, b) => b[1].length - a[1].length);
  const meta = (id) => PROJECTS[id] || { label: id === "no-project" ? "No project" : (id || "No project"), hue: 240 };
  $("#task-body").innerHTML = `<div class="proj-board">
    <div class="proj-board-hint">Read-only Trello view — switch to List or Board to edit</div>
    <div class="proj-grid">
      ${sorted.map(([pid, tasks]) => `<div class="proj-col" data-pid="${esc(pid)}">
        <div class="proj-col-h" style="--h:${meta(pid).hue}">
          <span class="proj-col-l">${esc(meta(pid).label)}</span>
          <span class="proj-col-n">${tasks.length}</span>
        </div>
        <div class="proj-cards">
          ${tasks.slice(0, 10).map((t) => `<div class="proj-card ${t.status === "doing" ? "now" : ""} ${t.status === "done" ? "done" : ""}" data-start="${t.id}" data-prio="${t.priority}">
            <div class="proj-card-t">${esc(trunc(t.title, 56))}</div>
            <div class="proj-card-m">${pGlyph(t.priority)}${dueChip(t.dueAt)}</div>
          </div>`).join("")}
          ${tasks.length > 10 ? `<div class="proj-card-more">+${tasks.length - 10} more</div>` : ""}
        </div>
      </div>`).join("")}
    </div>
  </div>`;
  $("#task-body").querySelectorAll(".proj-card[data-start]").forEach((c) => (c.ondblclick = () => { if (typeof openTaskDetail === "function") openTaskDetail(c.dataset.start); }));
  $("#task-body").querySelectorAll(".proj-card[data-start]").forEach((c) => (c.onclick = async () => {
    const id = c.dataset.start;
    const t = data.open.find((x) => x.id === id);
    await window.donna.setStatus(id, t?.status === "doing" ? "todo" : "doing");
    await refresh();
    if (view === "tasks") vTasks();
    renderCompactBody();
    toast(t?.status === "doing" ? "Paused" : "On it — focus started");
  }));
}

/* ── Task detail editor ──────────────────────────────────────────────────────
   Open from the ⋯ / ✎ button on a row, or double-click any task. Edit title,
   notes, priority, due date, project and estimate; delete or mark won't-do. */
async function openTaskDetail(id) {
  const existing = id ? [...(data.open || []), ...(data.done || [])].find((x) => x.id === id) : null;
  const isNew = !existing;
  const t = existing || { id: null, title: "", detail: "", priority: 2, dueAt: null, project_id: "", assignee: "", subtasks: [], recurrence: null, estimatedMinutes: null };
  let people = [];
  try { people = await window.donna.peopleList(); } catch {}
  let subs = (Array.isArray(t.subtasks) ? t.subtasks : []).map((x) => ({ ...x }));
  const el = document.createElement("div");
  el.id = "task-detail-ov";
  el.className = "sd-overlay";
  el.style.cssText = "position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(3,4,10,0.72);backdrop-filter:blur(6px)";
  const projList = [...new Set([...(data.open || []), ...(data.done || [])].map((x) => x.project_id).filter(Boolean))];
  el.innerHTML = `<div class="sd-panel" style="width:min(540px,94vw);background:var(--surface,#12121a);border:1px solid var(--line,#252530);border-radius:16px;padding:22px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font:600 15px var(--sans);color:var(--ink,#e8e8f0)">${isNew ? "New task" : "Edit task"}</div>
      <button id="td-close" class="icon-btn" title="Close" style="background:none;border:none;color:#9aa0b4;cursor:pointer;font-size:16px">×</button>
    </div>
    <input id="td-title" class="sd-input" value="${esc(t.title)}" placeholder="Title"
      style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:10px 12px;border-radius:9px;border:1px solid #252530;background:#0e0e15;color:#e8e8f0">
    <textarea id="td-notes" class="sd-input" rows="3" placeholder="Notes / detail"
      style="width:100%;box-sizing:border-box;margin-bottom:12px;padding:10px 12px;border-radius:9px;border:1px solid #252530;background:#0e0e15;color:#e8e8f0;resize:vertical">${esc(t.detail || "")}</textarea>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <label style="font:600 11px var(--sans);color:#8b90a6;text-transform:uppercase;letter-spacing:.06em">Assignee
        <input id="td-assignee" list="td-people" value="${esc(t.assignee || "")}" placeholder="me" style="width:100%;margin-top:5px;padding:9px 10px;border-radius:9px;border:1px solid #252530;background:#0e0e15;color:#e8e8f0">
        <datalist id="td-people">${people.map((p) => `<option value="${esc(p.name)}"></option>`).join("")}</datalist></label>
      <label style="font:600 11px var(--sans);color:#8b90a6;text-transform:uppercase;letter-spacing:.06em">Priority
        <select id="td-priority" style="width:100%;margin-top:5px;padding:9px 10px;border-radius:9px;border:1px solid #252530;background:#0e0e15;color:#e8e8f0">
          ${[1, 2, 3, 4].map((p) => `<option value="${p}"${t.priority === p ? " selected" : ""}>P${p}</option>`).join("")}
        </select></label>
      <label style="font:600 11px var(--sans);color:#8b90a6;text-transform:uppercase;letter-spacing:.06em">Due
        <input id="td-due" type="date" value="${t.dueAt ? String(t.dueAt).slice(0, 10) : ""}" style="width:100%;margin-top:5px;padding:9px 10px;border-radius:9px;border:1px solid #252530;background:#0e0e15;color:#e8e8f0;color-scheme:dark"></label>
      <label style="font:600 11px var(--sans);color:#8b90a6;text-transform:uppercase;letter-spacing:.06em">Project
        <input id="td-project" list="td-projects" value="${esc(t.project_id || "")}" placeholder="e.g. work" style="width:100%;margin-top:5px;padding:9px 10px;border-radius:9px;border:1px solid #252530;background:#0e0e15;color:#e8e8f0">
        <datalist id="td-projects">${projList.map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist></label>
      <label style="font:600 11px var(--sans);color:#8b90a6;text-transform:uppercase;letter-spacing:.06em">Estimate (min)
        <input id="td-est" type="number" min="0" value="${t.estimatedMinutes || ""}" placeholder="30" style="width:100%;margin-top:5px;padding:9px 10px;border-radius:9px;border:1px solid #252530;background:#0e0e15;color:#e8e8f0"></label>
    </div>
    <label style="display:block;font:600 11px var(--sans);color:#8b90a6;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px">Repeats
      <select id="td-recur" style="width:100%;margin-top:5px;padding:9px 10px;border-radius:9px;border:1px solid #252530;background:#0e0e15;color:#e8e8f0">
        <option value="">Never</option>
        <option value="daily"${(t.recurrence && t.recurrence.freq === "daily") ? " selected" : ""}>Daily</option>
        <option value="weekdays"${(t.recurrence && t.recurrence.freq === "weekdays") ? " selected" : ""}>Weekdays</option>
        <option value="weekly"${(t.recurrence && t.recurrence.freq === "weekly") ? " selected" : ""}>Weekly</option>
      </select></label>
    <div style="margin-bottom:16px">
      <div style="font:600 11px var(--sans);color:#8b90a6;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Subtasks</div>
      <div id="td-subs"></div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <input id="td-sub-in" placeholder="Add a subtask…" style="flex:1;padding:8px 10px;border-radius:9px;border:1px solid #252530;background:#0e0e15;color:#e8e8f0">
        <button id="td-sub-add" style="padding:8px 12px;border-radius:9px;border:1px solid #252530;background:transparent;color:#9aa0b4;cursor:pointer">Add</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      ${isNew ? "" : `<button id="td-del" style="padding:9px 14px;border-radius:9px;border:1px solid rgba(255,107,107,.35);background:transparent;color:#ff6b6b;cursor:pointer">Delete</button>
      <button id="td-wont" style="padding:9px 14px;border-radius:9px;border:1px solid #252530;background:transparent;color:#9aa0b4;cursor:pointer">Won't do</button>`}
      <button id="td-save" style="margin-left:auto;padding:9px 18px;border-radius:9px;border:none;background:linear-gradient(135deg,#818cf8,#6366f1);color:#fff;font-weight:600;cursor:pointer">Save</button>
    </div>
  </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  el.querySelector("#td-close").onclick = close;
  const subsWrap = el.querySelector("#td-subs");
  const renderSubs = () => {
    subsWrap.innerHTML = subs.length ? subs.map((x, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0">
        <button data-subtoggle="${i}" style="width:16px;height:16px;border-radius:4px;border:1px solid #3a3a4a;background:${x.done ? "#6366f1" : "transparent"};color:#fff;cursor:pointer;line-height:1">${x.done ? "✓" : ""}</button>
        <span style="flex:1;font-size:13px;color:${x.done ? "#6b7280" : "#e8e8f0"};text-decoration:${x.done ? "line-through" : "none"}">${esc(x.text)}</span>
        <button data-subrm="${i}" style="background:none;border:none;color:#6b7280;cursor:pointer">×</button>
      </div>`).join("") : '<div style="font-size:12px;color:#6b7280">No subtasks.</div>';
    subsWrap.querySelectorAll("[data-subtoggle]").forEach((b) => (b.onclick = () => { const i = +b.dataset.subtoggle; subs[i].done = !subs[i].done; renderSubs(); }));
    subsWrap.querySelectorAll("[data-subrm]").forEach((b) => (b.onclick = () => { subs.splice(+b.dataset.subrm, 1); renderSubs(); }));
  };
  renderSubs();
  const addSub = () => {
    const inp = el.querySelector("#td-sub-in");
    const v = (inp.value || "").trim();
    if (!v) return;
    subs.push({ id: `s_${Date.now()}`, text: v, done: false });
    inp.value = ""; renderSubs(); inp.focus();
  };
  el.querySelector("#td-sub-add").onclick = addSub;
  el.querySelector("#td-sub-in").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } };
  const after = async (msg) => { close(); await refresh(); if (view === "tasks") vTasks(); try { renderCompactBody(); } catch {} if (msg) toast(msg); };
  el.querySelector("#td-save").onclick = async () => {
    const title = el.querySelector("#td-title").value.trim();
    if (isNew) {
      if (!title) { const ti = el.querySelector("#td-title"); ti.focus(); return; }
      const newId = await window.donna.addTask(title);
      const notes0 = el.querySelector("#td-notes").value; if (notes0) await window.donna.setTaskField(newId, "detail", notes0);
      const pr0 = Number(el.querySelector("#td-priority").value); if (pr0 !== 2) await window.donna.setPriority(newId, pr0);
      const due0 = el.querySelector("#td-due").value; if (due0) await window.donna.setDue(newId, due0);
      const proj0 = el.querySelector("#td-project").value.trim(); if (proj0) await window.donna.setTaskField(newId, "project_id", proj0);
      const asg0 = (el.querySelector("#td-assignee").value || "").trim(); if (asg0) await window.donna.setTaskField(newId, "assignee", asg0);
      const est0 = el.querySelector("#td-est").value; if (est0) await window.donna.setTaskField(newId, "estimatedMinutes", Number(est0));
      if (subs.length) await window.donna.setTaskField(newId, "subtasks", subs);
      const freq0 = el.querySelector("#td-recur").value; if (freq0) await window.donna.setTaskField(newId, "recurrence", { freq: freq0 });
      await after("Added");
      return;
    }
    if (title && title !== t.title) await window.donna.setTaskField(id, "title", title);
    const notes = el.querySelector("#td-notes").value;
    if (notes !== (t.detail || "")) await window.donna.setTaskField(id, "detail", notes);
    const pr = Number(el.querySelector("#td-priority").value);
    if (pr !== t.priority) await window.donna.setPriority(id, pr);
    const due = el.querySelector("#td-due").value;
    if (due) { if ((t.dueAt || "").slice(0, 10) !== due) await window.donna.setDue(id, due); }
    else if (t.dueAt) await window.donna.setDue(id, null);
    const proj = el.querySelector("#td-project").value.trim();
    if (proj !== (t.project_id || "")) await window.donna.setTaskField(id, "project_id", proj || null);
    const asg = (el.querySelector("#td-assignee").value || "").trim();
    if (asg !== (t.assignee || "")) await window.donna.setTaskField(id, "assignee", asg || null);
    const est = el.querySelector("#td-est").value;
    if ((t.estimatedMinutes || null) !== (est ? Number(est) : null)) await window.donna.setTaskField(id, "estimatedMinutes", est ? Number(est) : null);
    await window.donna.setTaskField(id, "subtasks", subs);
    const freq = el.querySelector("#td-recur").value;
    if (freq !== ((t.recurrence && t.recurrence.freq) || "")) await window.donna.setTaskField(id, "recurrence", freq ? { freq } : null);
    await after("Saved");
  };
  const delBtn = el.querySelector("#td-del"); if (delBtn) delBtn.onclick = async () => {
    if (!confirm("Delete this task?")) return;
    await window.donna.removeTask(id);
    await after("Deleted");
  };
  const wontBtn = el.querySelector("#td-wont"); if (wontBtn) wontBtn.onclick = async () => {
    await window.donna.setWontDo(id, "not this time");
    await after("Marked won't do");
  };
  const ti = el.querySelector("#td-title");
  ti.focus(); ti.setSelectionRange(ti.value.length, ti.value.length);
}
