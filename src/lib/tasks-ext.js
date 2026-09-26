/* tasks-ext.js — backend capability owned by the Tasks page rebuild.
   Reached only through window.donna.ext("tasks-ext", fn, ...args); main.js is
   never edited. Shares the exact data/tasks.json record shape with ./tasks, so
   the two writers stay compatible. Owns what the original tasks.js verbs don't:
   tags, dependencies (blocked-by), bulk edits, duplicate, templates and saved
   views. */

const fs = require("node:fs");
const path = require("node:path");
const { dataPath } = require("./paths");
const tasks = require("./tasks");

const FILE = tasks.TASKS_FILE;
const VIEWS_FILE = dataPath("task_views.json");
const TPL_FILE = dataPath("task_templates.json");

const read = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fb; } };
const write = (p, v) => {
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2)); } catch {}
};
function readTasks() { const d = read(FILE, { version: 1, tasks: [] }); if (!Array.isArray(d.tasks)) d.tasks = []; return d; }
const writeTasks = (d) => write(FILE, d);
const nowIso = () => new Date().toISOString();

/* Collision-proof id for sidecar records (views/templates) — Date.now() alone
   repeats when two are saved in the same millisecond. */
function uid(prefix, existing) {
  const ids = new Set((existing || []).map((x) => x.id));
  let id;
  do { id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; } while (ids.has(id));
  return id;
}

/* ── tags ────────────────────────────────────────────────────────────────── */
/* Normalise a tag list: trim, drop a leading +, collapse dupes, cap length
   and count so a stray paste can't bloat a row. */
function normTags(list, max = 12) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const t = String(raw || "").replace(/^\+/, "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function setTags(id, list) {
  const d = readTasks();
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return null;
  t.tags = normTags(list);
  t.updatedAt = nowIso();
  writeTasks(d);
  return t.tags;
}

function addTag(id, tag) { return setTags(id, [...(findTags(id) || []), tag]); }
function removeTag(id, tag) { return setTags(id, (findTags(id) || []).filter((x) => x !== String(tag).toLowerCase())); }
function findTags(id) { const t = readTasks().tasks.find((x) => x.id === id); return t ? (Array.isArray(t.tags) ? t.tags : []) : null; }

/* label → count across every task (open + done), for the tag filter rail */
function tagIndex() {
  const counts = {};
  for (const t of readTasks().tasks) for (const tag of (Array.isArray(t.tags) ? t.tags : [])) counts[tag] = (counts[tag] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}

/* ── dependencies ────────────────────────────────────────────────────────── */
/* Deps are ids of tasks that must finish before this one can start. We refuse
   cycles (a → b → a) and self-links so the graph stays a DAG the scheduler can
   trust. Returns { ok, dependsOn } or { ok:false, error }. */
function setDeps(id, ids) {
  const d = readTasks();
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return { ok: false, error: "no such task" };
  const clean = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((x) => x && x !== id && d.tasks.some((y) => y.id === x));
  if (wouldCycle(d.tasks, id, clean)) return { ok: false, error: "That would create a circular dependency" };
  t.dependsOn = clean;
  t.updatedAt = nowIso();
  writeTasks(d);
  return { ok: true, dependsOn: clean };
}

/* would linking `id` → deps close a loop? Walk each dep's ancestors; if we
   reach `id`, it's a cycle. */
function wouldCycle(tasksArr, id, deps) {
  const byId = new Map(tasksArr.map((t) => [t.id, t]));
  const seen = new Set();
  const stack = [...deps];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === id) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const t = byId.get(cur);
    if (t && Array.isArray(t.dependsOn)) stack.push(...t.dependsOn);
  }
  return false;
}

/* every non-done task as a lightweight ref, for the dependency picker and the
   blocked-by resolver. */
function allRefs() {
  return readTasks().tasks
    .filter((t) => t.status !== "done")
    .map((t) => ({ id: t.id, title: t.title || "(untitled)", status: t.status || "todo", priority: t.priority || 3 }))
    .slice(0, 500);
}

/* ── bulk edits ──────────────────────────────────────────────────────────── */
const BULK_KEYS = ["priority", "dueAt", "project_id", "area", "bucket", "status", "estimatedMinutes", "deadline", "assignee", "waitingOn"];

function bulkUpdate(ids, patch) {
  const d = readTasks();
  const want = new Set((Array.isArray(ids) ? ids : []).map(String));
  const p = patch && typeof patch === "object" ? patch : {};
  let n = 0;
  const completeIds = [];
  for (const t of d.tasks) {
    if (!want.has(t.id)) continue;
    for (const k of BULK_KEYS) {
      if (!(k in p)) continue;
      /* completion goes through tasks.complete() below so sessions, activity
         and recurrence all fire — never a raw status flip. */
      if (k === "status" && p.status === "done") { completeIds.push(t.id); continue; }
      t[k] = p[k];
    }
    if (Array.isArray(p.addTags) && p.addTags.length) t.tags = normTags([...(Array.isArray(t.tags) ? t.tags : []), ...p.addTags]);
    if (Array.isArray(p.removeTags) && p.removeTags.length) {
      const rm = new Set(normTags(p.removeTags));
      t.tags = (Array.isArray(t.tags) ? t.tags : []).filter((x) => !rm.has(x));
    }
    if (p.status && p.status !== "done") { t.completedAt = null; if (p.status !== "doing") t.startedAt = null; }
    t.updatedAt = nowIso();
    n++;
  }
  writeTasks(d);
  for (const id of completeIds) { try { require("./tasks").complete(id); } catch {} }
  return { ok: true, count: n };
}

function deleteMany(ids) {
  const want = new Set((Array.isArray(ids) ? ids : []).map(String));
  const d = readTasks();
  const before = d.tasks.length;
  d.tasks = d.tasks.filter((t) => !want.has(t.id));
  /* also drop deleted ids from any survivor's deps */
  for (const t of d.tasks) if (Array.isArray(t.dependsOn)) t.dependsOn = t.dependsOn.filter((x) => !want.has(x));
  writeTasks(d);
  return { ok: true, removed: before - d.tasks.length };
}

/* ── duplicate ───────────────────────────────────────────────────────────── */
function duplicate(id) {
  const d = readTasks();
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return null;
  const copy = JSON.parse(JSON.stringify(t));
  copy.id = tasks.newId(d.tasks);
  copy.status = "todo";
  copy.startedAt = null;
  copy.completedAt = null;
  copy.wontDo = false;
  copy.wontDoReason = null;
  copy.createdAt = nowIso();
  copy.updatedAt = nowIso();
  copy.subtasks = (Array.isArray(t.subtasks) ? t.subtasks : []).map((s) => ({ ...s, done: false }));
  d.tasks.push(copy);
  writeTasks(d);
  return copy.id;
}

/* ── templates ───────────────────────────────────────────────────────────── */
function readTpl() { const d = read(TPL_FILE, { templates: [] }); if (!Array.isArray(d.templates)) d.templates = []; return d; }
const TPL_FIELDS = ["title", "detail", "priority", "project_id", "area", "bucket", "estimatedMinutes", "deadline", "deadlineHard", "tags", "subtasks", "recurrence", "assignee"];

function templatesList() { return readTpl().templates.map((x) => ({ id: x.id, name: x.name, title: x.spec && x.spec.title })); }

function templateSave(name, spec) {
  const nm = String(name || "").trim().slice(0, 60);
  if (!nm) return { ok: false, error: "Name required" };
  const d = readTpl();
  const clean = {};
  for (const k of TPL_FIELDS) if (spec && k in spec) clean[k] = spec[k];
  clean.tags = normTags(clean.tags);
  const existing = d.templates.find((x) => x.name.toLowerCase() === nm.toLowerCase());
  if (existing) { existing.spec = clean; existing.at = nowIso(); }
  else d.templates.push({ id: uid("tpl", d.templates), name: nm, spec: clean, at: nowIso() });
  write(TPL_FILE, d);
  return { ok: true, name: nm };
}

function templateSaveFromTask(id, name) {
  const t = readTasks().tasks.find((x) => x.id === id);
  if (!t) return { ok: false, error: "no such task" };
  return templateSave(name, t);
}

function templateRemove(nameOrId) {
  const d = readTpl();
  const key = String(nameOrId || "").toLowerCase();
  d.templates = d.templates.filter((x) => x.id !== nameOrId && x.name.toLowerCase() !== key);
  write(TPL_FILE, d);
  return { ok: true };
}

function templateInstantiate(nameOrId) {
  const d = readTpl();
  const key = String(nameOrId || "").toLowerCase();
  const tpl = d.templates.find((x) => x.id === nameOrId || x.name.toLowerCase() === key);
  if (!tpl) return { ok: false, error: "no such template" };
  const raw = readTasks();
  const now = nowIso();
  const id = tasks.newId(raw.tasks);
  const spec = tpl.spec || {};
  const task = {
    id, assigneeUserId: "me", title: spec.title || tpl.name, detail: spec.detail || "",
    link: null, status: "todo", source: "donna", board: null,
    project_id: spec.project_id || null, dueAt: null, dueTime: null,
    deadline: spec.deadline || null, deadlineHard: !!spec.deadlineHard,
    priority: spec.priority || 3, estimatedMinutes: spec.estimatedMinutes || null,
    bucket: spec.bucket || null, area: spec.area || null, waitingOn: null, assignee: spec.assignee || null,
    tags: normTags(spec.tags), dependsOn: [],
    subtasks: (Array.isArray(spec.subtasks) ? spec.subtasks : []).map((s) => ({ id: s.id || `s_${Date.now()}`, text: s.text || "", done: false })),
    recurrence: spec.recurrence || null,
    createdAt: now, createdBy: "donna", updatedAt: now, updatedBy: "donna", completedAt: null,
  };
  raw.tasks.push(task);
  writeTasks(raw);
  return { ok: true, id };
}

/* ── saved views ─────────────────────────────────────────────────────────── */
function viewsList() {
  const d = read(VIEWS_FILE, { views: [] });
  return Array.isArray(d.views) ? d.views : [];
}
function viewSave(name, payload) {
  const nm = String(name || "").trim().slice(0, 60);
  if (!nm) return { ok: false, error: "Name required" };
  const d = read(VIEWS_FILE, { views: [] });
  if (!Array.isArray(d.views)) d.views = [];
  const p = payload && typeof payload === "object" ? payload : {};
  const existing = d.views.find((x) => x.name.toLowerCase() === nm.toLowerCase());
  if (existing) { existing.payload = p; existing.at = nowIso(); }
  else d.views.push({ id: uid("view", d.views), name: nm, payload: p, at: nowIso() });
  write(VIEWS_FILE, d);
  return { ok: true, name: nm };
}
function viewRemove(nameOrId) {
  const d = read(VIEWS_FILE, { views: [] });
  const key = String(nameOrId || "").toLowerCase();
  d.views = (d.views || []).filter((x) => x.id !== nameOrId && x.name.toLowerCase() !== key);
  write(VIEWS_FILE, d);
  return { ok: true };
}

module.exports = {
  setTags, addTag, removeTag, tagIndex,
  setDeps, allRefs,
  bulkUpdate, deleteMany, duplicate,
  templatesList, templateSave, templateSaveFromTask, templateRemove, templateInstantiate,
  viewsList, viewSave, viewRemove,
  normTags,
};
