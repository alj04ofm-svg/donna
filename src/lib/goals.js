const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Goals — a real achievement system, not a progress bar. Synthesises the best of:
   · OKRs (Measure What Matters): an Objective + measurable Key Results
   · 12 Week Year: a short horizon + a weekly commitment score (lead measure) +
     a life plan spans every domain that matters, capped so none can hide behind
     volume — see DOMAINS + domainCoverage()
   · Atomic Habits: an identity "why" (who this makes you), systems > goals
   · The One Thing: the single highest-leverage lever per goal
   A goal breaks into Key Results (lag) + Milestones (the path) + a weekly
   commitment you actually control (lead). Key results can also carry a
   `grade` (0.0–1.0) set at horizon close (Measure What Matters' OKR grading —
   scored honestly, not just done/not-done). */

const FILE = dataPath("goals.json");
const DOMAINS = ["work", "money", "health", "relationships"];
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); } catch {} };
const uid = (p) => `${p}_${Date.now()}_${Math.floor((read().length || 0))}`;

// migrate any old {title,target,progress} goals into the new shape
function normalize(g) {
  if (g.objective) return { domain: "work", ...g };
  return {
    id: g.id, objective: g.title || "Goal", why: "", horizon: g.horizon || "12wk", domain: g.domain || "work",
    oneThing: "", keyResults: g.target ? [{ id: "kr_legacy", text: g.title || "", current: g.progress || 0, target: g.target, unit: "" }] : [],
    milestones: [], week: { committed: 0, done: 0, at: null },
    createdAt: g.createdAt || new Date().toISOString(), done: !!g.done,
  };
}

/* 12 Week Year rule: no domain should sit empty for a whole quarter. Returns
   active-goal counts per domain so the UI can flag whichever is at zero. */
function domainCoverage() {
  const counts = Object.fromEntries(DOMAINS.map((d) => [d, 0]));
  for (const g of list()) if (!g.done) counts[g.domain] = (counts[g.domain] || 0) + 1;
  return counts;
}

/* 12-Week-Year execution cycle: cycleStart = the Monday of the week the goal
   was created in. Week N of 12 advances once a week. Weeks-left drives the
   "you have 32 days to hit this" tension that wakes people up at weekly
   review — most goal systems hide the deadline and people coast. */
function cycleWeek(g) {
  if (!g.cycleStart) return 1;
  const start = new Date(g.cycleStart).getTime();
  const weeks = Math.floor((Date.now() - start) / (7 * 86400000));
  return Math.min(12, Math.max(1, weeks + 1));
}
function cycleDaysLeft(g) {
  if (!g.cycleStart) return 84;
  const end = new Date(g.cycleStart).getTime() + 12 * 7 * 86400000;
  return Math.max(0, Math.round((end - Date.now()) / 86400000));
}

/* Aggregate the lead-measure execution across all active goals this week — the
   12 Week Year scorecard. One number, one bar, for the cycle header. */
function aggregateWeek(goals) {
  const active = goals.filter((g) => !g.done && g.week && (g.week.committed || 0) > 0);
  const committed = active.reduce((n, g) => n + (g.week.committed || 0), 0);
  const done = active.reduce((n, g) => n + (g.week.done || 0), 0);
  return { committed, done, pct: committed ? Math.round(done / committed * 100) : 0, goals: active.length };
}

function pct(g) {
  const krs = g.keyResults || [];
  if (!krs.length) return g.done ? 100 : 0;
  const sum = krs.reduce((n, k) => n + (k.target ? Math.min(1, (k.current || 0) / k.target) : 0), 0);
  return Math.round(sum / krs.length * 100);
}

function list() {
  return read().map(normalize).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((g) => ({ ...g, pct: pct(g), cycleWeek: cycleWeek(g), cycleDaysLeft: cycleDaysLeft(g) }));
}
function add(objective, why, domain) {
  const a = read();
  /* start the 12-week cycle on the Monday of this week — keeps every goal
     on the same weekly cadence so the scorecard sums cleanly across domains */
  const start = new Date();
  const dow = (start.getDay() + 6) % 7; // 0 = Monday
  start.setDate(start.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  a.push({
    id: uid("g"),
    objective: (objective || "New goal").slice(0, 140),
    why: (why || "").slice(0, 200),
    horizon: "12wk",
    domain: DOMAINS.includes(domain) ? domain : "work",
    oneThing: "",
    cycleStart: start.toISOString(),
    keyResults: [],
    milestones: [],
    week: { committed: 0, done: 0, at: null },
    createdAt: new Date().toISOString(),
    done: false,
  });
  write(a);
  try { require("./activity").log("goal_added", (objective || "New goal").slice(0, 200), { domain, ref: { type: "goal", id: a[a.length - 1].id } }); } catch {}
}
function update(id, patch) {
  const a = read(); const g = a.find((x) => x.id === id);
  if (g) {
    const reached = patch && patch.done === true && !g.done;
    const reopened = patch && patch.done === false && g.done;
    Object.assign(g, patch);
    write(a);
    try {
      if (reached) require("./activity").log("goal_reached", g.objective, { domain: g.domain, ref: { type: "goal", id: g.id } });
      else if (reopened) require("./activity").log("goal_reopened", g.objective, { domain: g.domain, ref: { type: "goal", id: g.id } });
    } catch {}
  }
  return !!g;
}
function remove(id) { write(read().filter((x) => x.id !== id)); }

/* Resolve a free-form needle (from the `>>phrase` task grammar) to a goal id.
   Slug-exact match first, then case-insensitive substring of objective —
   matches the user's mental model: "ship reel >>world cup" finds the
   "World Cup reels live" goal. Returns null if no match; the renderer
   treats null as "unlinked", not error. */
function findObjective(needle) {
  if (!needle) return null;
  const n = String(needle).toLowerCase().trim();
  const all = read().map(normalize);
  const exact = all.find((g) => g.id === n);
  if (exact) return exact.id;
  const sub = all.find((g) => (g.objective || "").toLowerCase().includes(n));
  return sub ? sub.id : null;
}

/* Top-priority active goal — used by Today view to surface "this week's lead"
   without forcing a navigation into Goals. */
function topLead() {
  const g = list().find((x) => !x.done && x.oneThing);
  return g ? { id: g.id, objective: g.objective, oneThing: g.oneThing, pct: g.pct, domain: g.domain, cycleWeek: g.cycleWeek } : null;
}

function addKR(id, text, target, unit) { const a = read(); const g = a.find((x) => x.id === id); if (g) { (g.keyResults = g.keyResults || []).push({ id: `kr_${Date.now()}`, text: text || "", current: 0, target: Number(target) || 0, unit: unit || "" }); write(a); } }
function updateKR(id, krId, patch) { const a = read(); const g = a.find((x) => x.id === id); const k = g && (g.keyResults || []).find((x) => x.id === krId); if (k) { Object.assign(k, patch); write(a); } }
function removeKR(id, krId) { const a = read(); const g = a.find((x) => x.id === id); if (g) { g.keyResults = (g.keyResults || []).filter((x) => x.id !== krId); write(a); } }

function addMilestone(id, text) { const a = read(); const g = a.find((x) => x.id === id); if (g) { (g.milestones = g.milestones || []).push({ id: `m_${Date.now()}`, text: text || "", done: false }); write(a); } }
function toggleMilestone(id, mId) { const a = read(); const g = a.find((x) => x.id === id); const m = g && (g.milestones || []).find((x) => x.id === mId); if (m) { m.done = !m.done; write(a); } }
function removeMilestone(id, mId) { const a = read(); const g = a.find((x) => x.id === id); if (g) { g.milestones = (g.milestones || []).filter((x) => x.id !== mId); write(a); } }

function setWeek(id, committed, done) {
  const a = read(); const g = a.find((x) => x.id === id);
  if (g) {
    g.week = { committed: Number(committed) || 0, done: Number(done) || 0, at: new Date().toISOString() };
    write(a);
    try { require("./activity").log("goal_week", `${g.objective} — ${g.week.done}/${g.week.committed} this week`, { domain: g.domain, ref: { type: "goal", id: g.id } }); } catch {}
  }
}

/* Goal templates — pre-built OKR/12-week shells. Removes blank-page
   friction. Each template creates the goal + suggested KRs + a placeholder
   oneThing. Returns the new goal id. */
const TEMPLATES = {
  "12wk-okr": {
    label: "12-week OKR",
    objective: "Set your 12-week objective here",
    why: "What does achieving this unlock for you?",
    domain: "work",
    krs: [
      { text: "Key result 1 — measurable outcome", target: 100, unit: "%" },
      { text: "Key result 2 — measurable outcome", target: 100, unit: "%" },
      { text: "Key result 3 — measurable outcome", target: 100, unit: "%" },
    ],
    milestones: [
      { text: "Milestone 1 — week 4" },
      { text: "Milestone 2 — week 8" },
    ],
    oneThing: "The single lever that moves this most",
  },
  "habit-stack": {
    label: "Habit stack",
    objective: "Build a daily non-negotiable routine",
    why: "Systems over goals. The routine IS the goal.",
    domain: "health",
    krs: [
      { text: "Days completed this cycle", target: 84, unit: "d" },
    ],
    milestones: [
      { text: "First 7-day streak" },
      { text: "Full 12 weeks" },
    ],
    oneThing: "Trigger → action → identity",
  },
  "ship-it": {
    label: "Ship a thing",
    objective: "Ship one specific deliverable",
    why: "What does shipping unlock?",
    domain: "work",
    krs: [
      { text: "Version 1 live", target: 1, unit: "" },
      { text: "First 10 users", target: 10, unit: "" },
    ],
    milestones: [
      { text: "MVP cut" },
      { text: "Soft launch" },
    ],
    oneThing: "Cut the smallest shippable thing",
  },
};

function applyTemplate(key) {
  const t = TEMPLATES[key];
  if (!t) return null;
  const id = add(t.objective, t.why, t.domain);
  for (const k of t.krs || []) addKR(id, k.text, k.target, k.unit);
  for (const m of t.milestones || []) addMilestone(id, m.text);
  if (t.oneThing) update(id, { oneThing: t.oneThing });
  return id;
}

function listTemplates() { return Object.entries(TEMPLATES).map(([k, v]) => ({ key: k, ...v })); }

module.exports = { DOMAINS, list, add, update, remove, addKR, updateKR, removeKR, addMilestone, toggleMilestone, removeMilestone, setWeek, domainCoverage, aggregateWeek, cycleWeek, cycleDaysLeft, findObjective, topLead, applyTemplate, listTemplates, TEMPLATES };
