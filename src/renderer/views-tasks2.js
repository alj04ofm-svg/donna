/* views-tasks2.js — Tasks composer rebuild layer (loaded after views-tasks.js so
   this openTaskDetail wins). The old editor was a wall of fields. This is the
   minimal version: a title, then one-tap chips for the four things people
   actually set (priority, due, estimate, project). Everything else is behind
   "More options", so the default view never scrolls. */

async function openTaskDetail(id) {
  const existing = id ? findTask(id) : null;
  const isNew = !existing;
  const t = existing || {
    id: null, title: "", detail: "", status: "todo", priority: 3, dueAt: null, dueTime: null,
    deadline: null, deadlineHard: false, project_id: "", assignee: "", area: null,
    tags: [], dependsOn: [], subtasks: [], recurrence: null, estimatedMinutes: null, objectiveId: null,
  };
  let people = [], goals = [];
  try { people = await window.donna.peopleList(); } catch {}
  try { goals = await window.donna.goalsList(); } catch {}
  try { _taskRefs = await window.donna.ext("tasks-ext", "allRefs"); } catch { _taskRefs = []; }
  const projList = [...new Set([...(data.open || []), ...(data.done || [])].map((x) => x.project_id).filter(Boolean))];

  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const DUE_PRESETS = [["Today", iso(new Date())], ["Tomorrow", addDays(1)], ["+3 days", addDays(3)], ["Next week", addDays(7)], ["No date", ""]];
  const EST_PRESETS = [15, 30, 45, 60, 90];

  let prio = t.priority || 3;
  let due = t.dueAt ? String(t.dueAt).slice(0, 10) : "";
  let est = t.estimatedMinutes || null;
  let status = t.status || "todo";
  let deadline = t.deadline ? String(t.deadline).slice(0, 10) : "";
  let area = t.area || "";
  let assignee = t.assignee || "";
  let goal = t.objectiveId || "";
  let recur = (t.recurrence && t.recurrence.freq) || "";
  let tags = (Array.isArray(t.tags) ? t.tags : []).slice();
  let deps = (Array.isArray(t.dependsOn) ? t.dependsOn : []).slice();
  let subs = (Array.isArray(t.subtasks) ? t.subtasks : []).map((x) => ({ ...x }));
  let moreOpen = false;

  const el = document.createElement("div");
  el.id = "task-detail-ov";
  el.className = "tk-ov";
  document.body.appendChild(el);

  const close = () => el.remove();

  function render() {
    el.innerHTML = `<div class="tk-panel tk-panel-min" role="dialog" aria-label="${isNew ? "New task" : "Edit task"}">
      <div class="tk-panel-head">
        <span class="tk-panel-title">${isNew ? "New task" : "Edit task"}</span>
        <span class="spacer"></span>
        <button id="td-close" class="icon-btn" title="Close (esc)">×</button>
      </div>
      <input id="td-title" class="tk-title-input" placeholder="What needs doing?" value="${esc(t.title || "")}">
      <div class="tk-quick">
        <div class="tk-qrow"><span class="tk-qlabel">Priority</span><div class="tk-qchips">
          ${[1, 2, 3, 4].map((p) => `<button class="tk-qchip p${p} ${prio === p ? "on" : ""}" data-prio="${p}">${prioLabel(p)}</button>`).join("")}
        </div></div>
        <div class="tk-qrow"><span class="tk-qlabel">Due</span><div class="tk-qchips">
          ${DUE_PRESETS.map(([l, v]) => `<button class="tk-qchip ${due === v ? "on" : ""}" data-due="${v}">${l}</button>`).join("")}
          <input id="td-due-pick" type="date" class="tk-qdate" value="${due}" title="Pick a date">
        </div></div>
        <div class="tk-qrow"><span class="tk-qlabel">Estimate</span><div class="tk-qchips">
          ${EST_PRESETS.map((m) => `<button class="tk-qchip ${est === m ? "on" : ""}" data-est="${m}">${m}m</button>`).join("")}
          <input id="td-est-pick" type="number" min="0" class="tk-qdate tk-qnum" value="${est || ""}" placeholder="min" title="Custom minutes">
        </div></div>
        <div class="tk-qrow"><span class="tk-qlabel">Project</span>
          <input id="td-project" class="tk-qinput" list="td-projects" value="${esc(t.project_id || "")}" placeholder="e.g. work">
          <datalist id="td-projects">${projList.map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist>
        </div>
      </div>
      <textarea id="td-notes" class="tk-notes-min" rows="2" placeholder="Notes (optional)">${esc(t.detail || "")}</textarea>
      <button class="tk-more-toggle" id="td-more-toggle">${moreOpen ? "Fewer options ▴" : "More options ▾"}</button>
      ${moreOpen ? `<div class="tk-more">
        <div class="tk-more-grid">
          <label class="tk-field"><span>Status</span>
            <select id="td-status" class="tk-input">
              <option value="todo"${status === "todo" ? " selected" : ""}>To do</option>
              <option value="doing"${status === "doing" ? " selected" : ""}>In progress</option>
              <option value="done"${status === "done" ? " selected" : ""}>Done</option>
            </select></label>
          <label class="tk-field"><span>Deadline</span><input id="td-deadline" type="date" class="tk-input" value="${deadline}"></label>
          <label class="tk-field"><span>Area</span>
            <select id="td-area" class="tk-input"><option value="">None</option><option value="work"${area === "work" ? " selected" : ""}>Work</option><option value="money"${area === "money" ? " selected" : ""}>Money</option></select></label>
          <label class="tk-field"><span>Assignee</span><input id="td-assignee" class="tk-input" list="td-people" value="${esc(assignee)}" placeholder="me"><datalist id="td-people">${people.map((p) => `<option value="${esc(p.name)}"></option>`).join("")}</datalist></label>
          <label class="tk-field"><span>Repeats</span>
            <select id="td-recur" class="tk-input"><option value="">Never</option>${[["daily", "Daily"], ["weekdays", "Weekdays"], ["weekly", "Weekly"]].map(([v, l]) => `<option value="${v}"${recur === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="tk-field"><span>Goal</span>
            <select id="td-goal" class="tk-input"><option value="">Not linked</option>${goals.map((g) => `<option value="${esc(g.id)}"${goal === g.id ? " selected" : ""}>${esc(g.title || g.objective || "(goal)")}</option>`).join("")}</select></label>
        </div>
        <div class="tk-sect"><div class="tk-sect-h">Tags</div><div class="tk-chips" id="td-tags"></div>
          <input id="td-tag-in" class="tk-input tk-inline-input" list="td-tag-list" placeholder="Add a tag and press ↵">
          <datalist id="td-tag-list">${(_tagIndex || []).map((x) => `<option value="${esc(x.tag)}"></option>`).join("")}</datalist></div>
        <div class="tk-sect"><div class="tk-sect-h">Blocked by</div><div class="tk-chips" id="td-deps"></div>
          <input id="td-dep-in" class="tk-input tk-inline-input" list="td-dep-list" placeholder="Search open tasks and press ↵">
          <datalist id="td-dep-list"></datalist></div>
        <div class="tk-sect"><div class="tk-sect-h">Subtasks</div><div id="td-subs"></div>
          <input id="td-sub-in" class="tk-input tk-inline-input" placeholder="Add a subtask and press ↵"></div>
      </div>` : ""}
      <div class="tk-panel-actions">
        ${isNew ? "" : `<button id="td-dup" class="tk-btn">Duplicate</button><button id="td-del" class="tk-btn danger">Delete</button>`}
        <span class="spacer"></span>
        <button id="td-cancel" class="tk-btn ghost">Cancel</button>
        <button id="td-save" class="tk-btn primary">${isNew ? "Add task" : "Save"}</button>
      </div>
    </div>`;
    wire();
  }

  function wire() {
    el.querySelector("#td-close").onclick = close;
    el.querySelector("#td-cancel").onclick = close;
    el.addEventListener("mousedown", (e) => { if (e.target === el) close(); });

    el.querySelectorAll("[data-prio]").forEach((b) => (b.onclick = () => { prio = Number(b.dataset.prio); syncChips(); }));
    el.querySelectorAll("[data-due]").forEach((b) => (b.onclick = () => { due = b.dataset.due; syncChips(); }));
    el.querySelectorAll("[data-est]").forEach((b) => (b.onclick = () => { est = Number(b.dataset.est); syncChips(); }));
    const duePick = el.querySelector("#td-due-pick"); if (duePick) duePick.onchange = () => { due = duePick.value; syncChips(); };
    const estPick = el.querySelector("#td-est-pick"); if (estPick) estPick.onchange = () => { est = estPick.value ? Number(estPick.value) : null; syncChips(); };
    el.querySelector("#td-more-toggle").onclick = () => { moreOpen = !moreOpen; render(); };
    el.querySelector("#td-save").onclick = save;
    const del = el.querySelector("#td-del"); if (del) del.onclick = async () => { if (!confirm("Delete this task?")) return; await window.donna.removeTask(id); await after("Deleted"); };
    const dup = el.querySelector("#td-dup"); if (dup) dup.onclick = async () => { const nid = await window.donna.ext("tasks-ext", "duplicate", id); await after(nid ? "Duplicated" : "Couldn't duplicate"); };

    if (!moreOpen) return;
    const tagsWrap = el.querySelector("#td-tags");
    const renderTags = () => {
      tagsWrap.innerHTML = tags.length ? tags.map((x, i) => `<span class="tkc-tag" style="--h:${tagHue(x)}">${esc(x)}<button data-trm="${i}">×</button></span>`).join("") : '<span class="tk-mut">No tags</span>';
      tagsWrap.querySelectorAll("[data-trm]").forEach((b) => (b.onclick = () => { tags.splice(+b.dataset.trm, 1); renderTags(); }));
    };
    renderTags();
    const tagInp = el.querySelector("#td-tag-in");
    tagInp.onkeydown = (e) => { if (e.key !== "Enter") return; e.preventDefault(); const v = tagInp.value.trim().replace(/^\+/, "").toLowerCase().replace(/\s+/g, "-"); if (v && !tags.includes(v) && tags.length < 12) tags.push(v); tagInp.value = ""; renderTags(); };

    const depsWrap = el.querySelector("#td-deps"); const depList = el.querySelector("#td-dep-list");
    const renderDeps = () => {
      const chosen = deps.map((did) => _taskRefs.find((r) => r.id === did) || { id: did, title: "(done or removed)" });
      depsWrap.innerHTML = chosen.length ? chosen.map((r, i) => `<span class="tk-dep">⛓ ${esc(trunc(r.title, 30))}<button data-drm="${i}">×</button></span>`).join("") : '<span class="tk-mut">Nothing — free to start</span>';
      depsWrap.querySelectorAll("[data-drm]").forEach((b) => (b.onclick = () => { deps.splice(+b.dataset.drm, 1); renderDeps(); }));
      depList.innerHTML = _taskRefs.filter((r) => r.id !== id && !deps.includes(r.id)).map((r) => `<option value="${esc(r.title)}"></option>`).join("");
    };
    renderDeps();
    const depInp = el.querySelector("#td-dep-in");
    depInp.onkeydown = (e) => { if (e.key !== "Enter") return; e.preventDefault(); const q = depInp.value.trim().toLowerCase(); if (!q) return; const m = _taskRefs.find((r) => r.id !== id && !deps.includes(r.id) && r.title.toLowerCase().includes(q)); if (m) deps.push(m.id); depInp.value = ""; renderDeps(); };

    const subsWrap = el.querySelector("#td-subs");
    const renderSubs = () => {
      subsWrap.innerHTML = subs.length ? subs.map((x, i) => `<div class="tk-sub"><button class="check sel ${x.done ? "on" : ""}" data-subtoggle="${i}">${x.done ? CHECK_SVG : ""}</button><span class="tk-sub-text ${x.done ? "done" : ""}">${esc(x.text)}</span><button class="tk-x" data-subrm="${i}">×</button></div>`).join("") : '<span class="tk-mut">No subtasks</span>';
      subsWrap.querySelectorAll("[data-subtoggle]").forEach((b) => (b.onclick = () => { const i = +b.dataset.subtoggle; subs[i].done = !subs[i].done; renderSubs(); }));
      subsWrap.querySelectorAll("[data-subrm]").forEach((b) => (b.onclick = () => { subs.splice(+b.dataset.subrm, 1); renderSubs(); }));
    };
    renderSubs();
    const subInp = el.querySelector("#td-sub-in");
    subInp.onkeydown = (e) => { if (e.key !== "Enter") return; e.preventDefault(); const v = subInp.value.trim(); if (!v) return; subs.push({ id: `s_${Date.now()}`, text: v, done: false }); subInp.value = ""; renderSubs(); };
  }

  function syncChips() {
    el.querySelectorAll("[data-prio]").forEach((b) => b.classList.toggle("on", Number(b.dataset.prio) === prio));
    el.querySelectorAll("[data-due]").forEach((b) => b.classList.toggle("on", b.dataset.due === due));
    el.querySelectorAll("[data-est]").forEach((b) => b.classList.toggle("on", Number(b.dataset.est) === est));
  }

  async function save() {
    const title = el.querySelector("#td-title").value.trim();
    if (!title) { el.querySelector("#td-title").focus(); return; }
    const fields = {
      detail: el.querySelector("#td-notes").value,
      project_id: el.querySelector("#td-project").value.trim() || null,
      estimatedMinutes: est,
      tags,
    };
    if (moreOpen) {
      fields.status = el.querySelector("#td-status").value;
      fields.deadline = el.querySelector("#td-deadline").value || null;
      fields.deadlineHard = !!el.querySelector("#td-deadline").value;
      fields.area = el.querySelector("#td-area").value || null;
      fields.assignee = el.querySelector("#td-assignee").value.trim() || null;
      fields.recurrence = el.querySelector("#td-recur").value ? { freq: el.querySelector("#td-recur").value } : null;
      fields.objectiveId = el.querySelector("#td-goal").value || null;
      fields.subtasks = subs;
    }
    let target = id;
    if (isNew) target = await window.donna.addTask(title);
    await window.donna.setTaskField(target, "title", title);
    for (const [k, v] of Object.entries(fields)) await window.donna.setTaskField(target, k, v);
    await window.donna.setPriority(target, prio);
    await window.donna.setDue(target, due || null);
    if (moreOpen) await window.donna.ext("tasks-ext", "setDeps", target, deps);
    await after(isNew ? "Added" : "Saved");
  }

  async function after(msg) {
    close();
    await refresh();
    if (view === "tasks") vTasks();
    try { renderCompactBody(); } catch {}
    if (msg) toast(msg);
  }

  render();
  const ti = el.querySelector("#td-title");
  ti.focus(); ti.setSelectionRange(ti.value.length, ti.value.length);
}
