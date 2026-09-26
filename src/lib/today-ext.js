/* today-ext.js — backend capability owned by the Today page rebuild.
   Reached only through window.donna.ext("today-ext", fn, ...args); main.js is
   never edited. Keeps the Today page's own durable state (top-3 order, the
   edited day plan, the cached recap) plus bounded, honest handling of a
   focus timer that was left running. */

const fs = require("node:fs");
const path = require("node:path");
const { dataPath } = require("./paths");

const FILE = dataPath("today_ext.json");
const tasks = require("./tasks");

const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
const write = (d) => {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch {}
};
const todayKey = () => new Date().toISOString().slice(0, 10);

/* One read for everything the page needs to boot, so the renderer makes a
   single ext round-trip. Stale plan/recap from other days is simply omitted. */
function getState() {
  const d = read();
  const t = todayKey();
  return {
    top3: Array.isArray(d.top3) ? d.top3.filter(Boolean).map(String).slice(0, 3) : [],
    planDate: (d.plan && d.plan.date) || null,
    planBlocks: d.plan && d.plan.date === t && Array.isArray(d.plan.blocks) ? d.plan.blocks : null,
    planSavedAt: (d.plan && d.plan.savedAt) || null,
    recap: (d.recap && d.recap[t]) || null,
  };
}

function setTop3(ids) {
  const d = read();
  d.top3 = (Array.isArray(ids) ? ids : []).filter(Boolean).map(String).slice(0, 3);
  d.updatedAt = new Date().toISOString();
  write(d);
  return { top3: d.top3 };
}

/* Persist the user-edited schedule. `blocks` is the exact array the renderer
   shows, so a reload reproduces it byte-for-byte. */
function savePlan({ date, blocks } = {}) {
  const d = read();
  const clean = (Array.isArray(blocks) ? blocks : []).map((b) => ({
    id: String(b.id || ""),
    title: String(b.title || "").slice(0, 240),
    priority: Number(b.priority) || 3,
    project_id: b.project_id || null,
    s: Math.max(0, Math.min(1440, Math.round(Number(b.s) || 0))),
    e: Math.max(0, Math.min(1440, Math.round(Number(b.e) || 0))),
    doing: !!b.doing,
  })).filter((b) => b.id && b.e > b.s).sort((a, b) => a.s - b.s);
  d.plan = { date: date || todayKey(), blocks: clean, savedAt: new Date().toISOString() };
  write(d);
  return d.plan;
}

function clearPlan() {
  const d = read();
  delete d.plan;
  write(d);
  return { ok: true };
}

function saveRecap({ date, text, stats, source } = {}) {
  const key = date || todayKey();
  const d = read();
  d.recap = d.recap || {};
  d.recap[key] = {
    text: String(text || "").slice(0, 6000),
    stats: stats && typeof stats === "object" ? stats : null,
    source: source || "local",
    at: new Date().toISOString(),
  };
  /* keep a fortnight, no more */
  const keys = Object.keys(d.recap).sort();
  while (keys.length > 14) delete d.recap[keys.shift()];
  write(d);
  return d.recap[key];
}

function clearRecap() {
  const d = read();
  if (d.recap) delete d.recap[todayKey()];
  write(d);
  return { ok: true };
}

/* Directly settle the task row without going through tasks.setStatus (which
   would log the entire, possibly days-long, running segment). */
function settleTask(taskId, { status, actualAdd }) {
  if (!taskId) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(tasks.TASKS_FILE, "utf8"));
    const t = (raw.tasks || []).find((x) => x.id === taskId);
    if (!t) return false;
    if (actualAdd) t.actualMinutes = (t.actualMinutes || 0) + actualAdd;
    t.status = status || "todo";
    t.startedAt = null;
    t.updatedAt = new Date().toISOString();
    fs.writeFileSync(tasks.TASKS_FILE, JSON.stringify(raw, null, 2));
    return true;
  } catch { return false; }
}

/* A timer left running across a crash/quit: log a bounded, honest session
   (never the raw multi-day delta) and clear the doing state. minutes <= 0
   means "discard" — clear it and log nothing. */
function resolveStale({ taskId, minutes, title } = {}) {
  const mins = Math.round(Number(minutes) || 0);
  const bounded = Math.max(1, Math.min(180, mins));
  if (mins > 0) {
    const end = new Date();
    const start = new Date(end.getTime() - bounded * 60000);
    try { require("./sessions").log({ taskId, title, start: start.toISOString(), end: end.toISOString() }); } catch {}
  }
  settleTask(taskId, { status: "todo", actualAdd: mins > 0 ? bounded : 0 });
  return { ok: true, minutes: mins > 0 ? bounded : 0 };
}

/* Today's focus total, straight from the session log (no AI, no guessing). */
function focusSummary() {
  let todayMin = 0, sessions = 0, longest = 0;
  try {
    const s = require("./sessions").stats();
    todayMin = s.todayMin || 0;
    sessions = (s.todaySessions || []).length;
    longest = s.longest ? s.longest.minutes : 0;
  } catch {}
  return { todayMin, sessions, longest };
}

module.exports = { getState, setTop3, savePlan, clearPlan, saveRecap, clearRecap, resolveStale, focusSummary };
