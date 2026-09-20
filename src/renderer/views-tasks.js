/* a task is untriaged when it has no activation state at all — no bucket, no
   date, not being worked, not parked on someone. These feed the triage wizard. */
const isUntriaged = (t) => !t.bucket && !t.dueAt && t.status !== "doing" && !t.waitingOn && t.priority !== 1;

async function vTasks() {
  stagger = 0;
  const dueFilter = localStorage.getItem("donna.dueFilter");
  let allOpen = data.open.slice().sort((a, b) => a.priority - b.priority);
  if (dueFilter) {
    allOpen = allOpen.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === dueFilter);
  }
  const open = allOpen;
  curList = open;
  const untriaged = open.filter(isUntriaged);
  const handoffs = await window.donna.waitingList();
  const filterChip = dueFilter ? `<div class="tasks-filter-chip">${esc(dueFilter)}<button class="tasks-filter-x" id="tasks-filter-clear">×</button></div>` : "";
  const segHtml = `<div class="seg">
    <button class="${taskLayout === "list" ? "on" : ""}" data-lay="list">List</button>
    <button class="${taskLayout === "board" ? "on" : ""}" data-lay="board">Board</button>
    <button class="${taskLayout === "projects" ? "on" : ""}" data-lay="projects">By project</button>
  </div>`;
  main.innerHTML = `<div class="view wide">
    <div class="tasks-topbar">
      <div class="tasks-head">
        <div><h1 class="h1">Tasks</h1>
        <p class="sub">${data.counts.open} open<span class="sep">·</span>${data.done.length} done<span class="sep">·</span>synced with the dashboard${dueFilter ? `<span class="sep">·</span>filtering to ${esc(dueFilter)}` : ""}</p></div>
        <div class="tasks-head-acts">
          ${filterChip}
          ${untriaged.length >= 3 ? `<button class="triage-btn" id="btn-triage">▤ Triage ${untriaged.length}</button>` : ""}
          ${segHtml}
        </div>
      </div>
      <div class="quick-add tasks-add"><input id="task-in" placeholder='New task — "voice swap friday 3pm p1 #worldcup @work =2h" parses live'></div>
    </div>
    <div id="task-body"></div>
  </div>`;
  wireAdd($("#task-in"));
  const tb = $("#btn-triage"); if (tb) tb.onclick = () => openTriage(untriaged);
  const tc = $("#tasks-filter-clear"); if (tc) tc.onclick = () => { localStorage.removeItem("donna.dueFilter"); vTasks(); };
  $("#main .seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    taskLayout = b.dataset.lay;
    localStorage.setItem("donna.taskLayout", taskLayout);
    vTasks();
  });
  taskLayout === "board" ? paintBoard(open)
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
    <div class="quick-add" id="handoff-add-wrap" style="margin:0 0 4px"><input id="handoff-in" placeholder='Hand off to someone — "ElevenLabs invoice · george" ↵'></div>
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
    <div class="card-meta">${pGlyph(t.priority)}${col === "now" ? `<span class="chip now-chip">${elapsed(t.startedAt)}</span>` : ""}${t.waitingOn ? `<span class="chip wait">${esc(t.waitingOn)}</span>` : ""}${dueChip(t.dueAt)}</div>
  </div>`;
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
        ${cards.map(cardHtml).join("") || '<div class="empty" style="padding:14px">—</div>'}
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
