const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Habit replacement (Power of Habit) — for behaviors you want to change, not
   add. Cold-turkey deletion doesn't survive a bad week; keeping the same cue
   and reward but swapping the routine in between does. Each entry is a loop:
     cue        → what triggers the old behavior
     oldRoutine → what you do now
     newRoutine → what you're substituting in
     reward     → the thing you're actually still getting, so the swap sticks
   Logged same as a habit: a day is either "held the new routine" or not — no
   guilt pile on a miss, just a log. */

const FILE = dataPath("replacements.json");
const LOG = dataPath("replacements_log.json");

const DEFAULTS = [];

const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return DEFAULTS; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); } catch {} };
const readLog = () => { try { return JSON.parse(fs.readFileSync(LOG, "utf8")); } catch { return {}; } };
const writeLog = (l) => { try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.writeFileSync(LOG, JSON.stringify(l)); } catch {} };

function streakFor(id) {
  const log = readLog();
  let n = 0, d = new Date();
  if (!(log[d.toISOString().slice(0, 10)] || {})[id]) d.setDate(d.getDate() - 1);
  while ((log[d.toISOString().slice(0, 10)] || {})[id]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function list() {
  const today = new Date().toISOString().slice(0, 10);
  const log = readLog();
  return read().map((r) => ({ ...r, heldToday: !!(log[today] && log[today][r.id]), streak: streakFor(r.id) }));
}
function add(fields) {
  const a = read();
  a.push({ id: `r_${Date.now()}`, name: fields.name || "New replacement", domain: fields.domain || "health", cue: fields.cue || "", oldRoutine: fields.oldRoutine || "", newRoutine: fields.newRoutine || "", reward: fields.reward || "", createdAt: new Date().toISOString() });
  write(a);
}
function update(id, patch) { const a = read(); const r = a.find((x) => x.id === id); if (r) { Object.assign(r, patch); write(a); } return !!r; }
function remove(id) { write(read().filter((x) => x.id !== id)); }
function toggle(id) {
  const today = new Date().toISOString().slice(0, 10);
  const log = readLog();
  log[today] = log[today] || {};
  log[today][id] = !log[today][id];
  writeLog(log);
  return log[today][id];
}

module.exports = { list, add, update, remove, toggle };
