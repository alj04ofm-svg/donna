const fs = require("node:fs");
const { dataPath } = require("./paths");

// Donna owns the user's task store (kept in the app-data directory).
const TASKS_FILE = dataPath("tasks.json");
const PRIORITY_FILE = dataPath("priority_queue.json");
const POSTING_FILE = dataPath("posting_queue.json");

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

function normalize(t) {
  return {
    id: t.id, title: t.title || "(untitled)", detail: t.detail || "",
    status: t.status || "todo", priority: t.priority || 3,
    dueAt: t.dueAt || null,            // the WHEN — the day it shows up in Today (Things' start date)
    deadline: t.deadline || null,      // Donna-only: the real drop-dead date, distinct from when (Things/Motion)
    deadlineHard: !!t.deadlineHard,    // hard deadlines get at-risk warnings when work won't fit before them
    estimatedMinutes: t.estimatedMinutes || null,
    actualMinutes: t.actualMinutes || 0, // accumulated by focus-timer sessions — powers planned-vs-actual
    bucket: t.bucket || null,          // today | evening | anytime | someday — activation state, not a date
    area: t.area || null,              // work | money | health | relationships — the ONE life-area taxonomy
    objectiveId: t.objectiveId || null, // links execution to a weekly objective / Goals OKR
    wontDo: !!t.wontDo,                // consciously abandoned ≠ done ≠ deleted (TickTick) — shared store sees "done"
    wontDoReason: t.wontDoReason || null,
    waitingOn: t.waitingOn || null,    // Donna-only field: who it is blocked on.
    startedAt: t.startedAt || null,    // set when moved to doing — powers the Now timer
    updatedAt: t.updatedAt || null,
    project_id: t.project_id || null,  // groups tasks into tracks (WC / gossip / …)
    recurrence: t.recurrence || null,  // { freq: "daily"|"weekly"|"weekdays", dow?: number[] } — Donna regenerates next instance when this is completed
  };
}

function summary() {
  const data = readJson(TASKS_FILE, { tasks: [] });
  const all = (data.tasks || []).map(normalize);
  const open = all.filter((t) => t.status !== "done");
  const done = all.filter((t) => t.status === "done" && !t.wontDo);
  const wontdo = all.filter((t) => t.wontDo);
  const todayIso = new Date().toISOString().slice(0, 10);
  const doneToday = done.filter((t) => (t.updatedAt || "").slice(0, 10) === todayIso).length;
  const priorities = (readJson(PRIORITY_FILE, { queue: [] }).queue || []).slice(0, 6);
  const postingRaw = readJson(POSTING_FILE, []);
  const posting = (Array.isArray(postingRaw) ? postingRaw : []).map((q) => ({
    id: q.id, account: q.account_id || "—", model: q.model_id || "",
    reel: q.reel_id || q.job_id || "", status: q.status || "queued",
    platform: q.platform || "", scheduled: q.scheduled_time || "",
  }));
  return {
    open, done, wontdo,
    counts: {
      open: open.length,
      p1: open.filter((t) => t.priority === 1).length,
      due: open.filter((t) => t.dueAt).length,
      doneToday,
      now: open.filter((t) => t.status === "doing").length,
    },
    priorities,
    posting,
    postingCount: posting.length,
  };
}

function logSessionIfDoing(t, endIso) {
  if (t && t.status === "doing" && t.startedAt) {
    try { require("./sessions").log({ taskId: t.id, title: t.title, start: t.startedAt, end: endIso }); } catch {}
    // the session's minutes land on the task — powers planned-vs-actual honesty
    const mins = Math.round((new Date(endIso) - new Date(t.startedAt)) / 60000);
    if (mins > 0 && mins < 16 * 60) t.actualMinutes = (t.actualMinutes || 0) + mins;
  }
}

function complete(id) {
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  const t = (data.tasks || []).find((x) => x.id === id);
  if (t) {
    const now = new Date().toISOString();
    logSessionIfDoing(t, now);
    t.status = "done"; t.completedAt = now; t.updatedAt = now;
    try { require("./activity").log("task_done", t.title, { domain: t.area, ref: { type: "task", id: t.id } }); } catch {}
    /* recurrence: if this task has a recurrence rule, create the next
       instance so the schedule stays populated automatically. */
    try {
      if (t.recurrence && t.recurrence.freq) {
        const next = nextInstance(t);
        if (next) { data.tasks.push(next); }
      }
    } catch {}
  }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  return !!t;
}

/* compute the next instance of a recurring task after it was completed.
   Supported: daily (every 1d), weekdays (Mon-Fri), weekly (same dow). */
function nextInstance(t) {
  const r = t.recurrence || {};
  const lastDue = t.dueAt || t.completedAt || new Date().toISOString();
  const last = new Date(lastDue);
  const next = new Date(last);
  if (r.freq === "daily") next.setDate(last.getDate() + 1);
  else if (r.freq === "weekdays") {
    /* skip to the next weekday */
    do { next.setDate(next.getDate() + 1); } while (next.getDay() === 0 || next.getDay() === 6);
  } else if (r.freq === "weekly") next.setDate(last.getDate() + 7);
  else return null;
  const newId = `task_${Date.now()}_donna`;
  return {
    id: newId, assigneeUserId: "me", title: t.title, detail: t.detail || "",
    link: null, status: "todo", board: null, project_id: t.project_id || null,
    dueAt: next.toISOString().slice(0, 10), dueTime: t.dueTime || null,
    deadline: t.deadline || null, deadlineHard: t.deadlineHard || false,
    priority: t.priority || 3, estimatedMinutes: t.estimatedMinutes || null,
    bucket: t.bucket || null, area: t.area || null, waitingOn: t.waitingOn || null,
    createdAt: new Date().toISOString(), createdBy: "donna", updatedAt: new Date().toISOString(),
    updatedBy: "donna", completedAt: null,
    recurrence: r,
  };
}

function setDue(id, dueAt) {
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  const t = (data.tasks || []).find((x) => x.id === id);
  if (t) { t.dueAt = dueAt; t.updatedAt = new Date().toISOString(); }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  return !!t;
}

function setPriority(id, priority) {
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  const t = (data.tasks || []).find((x) => x.id === id);
  if (t) { t.priority = priority; t.updatedAt = new Date().toISOString(); }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  return !!t;
}

function setStatus(id, status) {
  // "todo" | "doing" | "done" — the shared store's exact TaskStatus union; never widen it
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  const t = (data.tasks || []).find((x) => x.id === id);
  if (t) {
    const now = new Date().toISOString();
    if (status !== "doing") logSessionIfDoing(t, now); // leaving a focus session → log it
    t.status = status;
    t.updatedAt = now;
    t.completedAt = status === "done" ? now : null;
    if (status === "doing") { t.startedAt = now; t.waitingOn = null; }
    if (status === "todo") t.startedAt = null;
  }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  return !!t;
}

/* Donna-only field setters — all passthrough fields the dashboard ignores.
   One guarded generic instead of five copies of the same read-find-write. */
const DONNA_FIELDS = ["bucket", "area", "estimatedMinutes", "deadline", "deadlineHard", "objectiveId"];
function setField(id, field, value) {
  if (!DONNA_FIELDS.includes(field)) return false;
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  const t = (data.tasks || []).find((x) => x.id === id);
  if (t) { t[field] = value; t.updatedAt = new Date().toISOString(); }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  return !!t;
}

/* consciously abandoned — the shared store sees a closed task ("done" is the
   only closed status in its union), Donna renders it as Won't Do, honestly. */
function setWontDo(id, reason) {
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  const t = (data.tasks || []).find((x) => x.id === id);
  if (t) {
    const now = new Date().toISOString();
    logSessionIfDoing(t, now);
    t.status = "done"; t.wontDo = true; t.wontDoReason = (reason || "").slice(0, 140) || null;
    t.completedAt = now; t.updatedAt = now; t.startedAt = null;
    try { require("./activity").log("task_wontdo", t.title + (t.wontDoReason ? ` — ${t.wontDoReason}` : ""), { domain: t.area, ref: { type: "task", id: t.id } }); } catch {}
  }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  return !!t;
}

/* focus-timer sessions land their minutes here — powers planned-vs-actual */
function remove(id) {
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  data.tasks = (data.tasks || []).filter((t) => t.id !== id);
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  return true;
}

function addActual(id, minutes) {
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  const t = (data.tasks || []).find((x) => x.id === id);
  if (t) { t.actualMinutes = (t.actualMinutes || 0) + Math.max(0, Math.round(minutes)); t.updatedAt = new Date().toISOString(); }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  return !!t;
}

function setWaiting(id, who) {
  // Donna-only lane: waitingOn is an extra passthrough field; status stays "todo"
  // so the team dashboard keeps rendering it as a normal open card.
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  const t = (data.tasks || []).find((x) => x.id === id);
  if (t) {
    t.waitingOn = who || null;
    if (who) { t.status = "todo"; t.startedAt = null; }
    t.updatedAt = new Date().toISOString();
  }
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  return !!t;
}

/* Natural-language add — the grammar lives in nlparse.js (shared with the
   renderer's live token highlighting, so what's marked is what's parsed). */
const { nlTokenize } = require("./nlparse");

function add(input, priority, detail) {
  const { parsed } = nlTokenize(input);
  if (priority) parsed.priority = priority;
  /* resolve >>needle to objectiveId — natural-language goal linking.
     "ship reel p1 >>world cup" finds the goal whose objective matches
     "world cup" (slug-exact, then substring) and auto-links the task. */
  if (parsed.objectiveNeedle) {
    try {
      const goalId = require("./goals").findObjective(parsed.objectiveNeedle);
      if (goalId) parsed.objectiveId = goalId;
    } catch {}
  }
  const data = readJson(TASKS_FILE, { version: 1, tasks: [] });
  const now = new Date().toISOString();
  const id = `task_${Date.now()}_donna`;
  data.tasks = data.tasks || [];
  data.tasks.push({
    id, assigneeUserId: "me", title: parsed.title || "(untitled)", detail: (detail || "").slice(0, 500), link: null, status: "todo",
    source: "donna", board: null, project_id: parsed.project_id, dueAt: parsed.dueAt, dueTime: parsed.dueTime,
    deadline: parsed.deadline, deadlineHard: parsed.deadlineHard, priority: parsed.priority,
    estimatedMinutes: parsed.estimatedMinutes, bucket: parsed.bucket, area: parsed.area, waitingOn: parsed.waitingOn,
    objectiveId: parsed.objectiveId || null, // auto-linked from >>needle
    createdAt: now, createdBy: "donna", updatedAt: now, updatedBy: "donna", completedAt: null,
  });
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  try { require("./activity").log("task_added", parsed.title || "(untitled)", { domain: parsed.area, ref: { type: "task", id } }); } catch {}
  return id;
}

module.exports = { summary, complete, setStatus, setWaiting, setDue, setPriority, add, setField, setWontDo, addActual, remove, TASKS_FILE };
