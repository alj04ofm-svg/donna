const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Routines — recurring behaviors, built on real mechanics instead of a bare
   checklist:
   · anchor, not a time-of-day bucket (Atomic Habits / Tiny Habits ABC —
     "after X, I will Y" beats "sometime this morning")
   · identity — each completion is a vote for who you're becoming (Atomic Habits)
   · keystone — the one habit flagged as the cascade point (Power of Habit):
     fix this one and several others move with it
   · microVersion — the <2-minute starter version for a hard day (2-Minute Rule)
   A miss just doesn't tick — no guilt pile. */

const FILE = dataPath("habits.json");
const LOG = dataPath("habits_log.json");

const DEFAULTS = [
  {
    id: "h_wake", name: "Wake at a consistent time", anchor: "feet on the floor before the phone",
    identity: "I start the day on my terms", keystone: true,
    microVersion: "just get up — even 10 minutes late beats not at all", freq: "daily",
  },
  { id: "h_move", name: "Move for 20 minutes", anchor: "before the day gets loud", identity: "I move, so I think", keystone: false, freq: "daily" },
  { id: "h_plan", name: "Plan tomorrow", anchor: "2 minutes before you close the laptop", identity: "I end each day ready for the next", keystone: false, freq: "daily" },
  { id: "h_read", name: "Read 10 pages", anchor: "before bed", identity: "", keystone: false, freq: "daily" },
  { id: "h_review", name: "Weekly review", anchor: "anytime", identity: "", keystone: false, freq: "weekly" },
];

const readHabits = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return DEFAULTS; } };
const readLog = () => { try { return JSON.parse(fs.readFileSync(LOG, "utf8")); } catch { return {}; } };
const writeLog = (l) => { try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.writeFileSync(LOG, JSON.stringify(l)); } catch {} };

function dueToday(h) {
  const dow = new Date().getDay();
  if (h.freq === "weekly") return dow === 0;         // Sunday
  if (h.freq === "weekdays") return dow >= 1 && dow <= 5;
  return true;                                        // daily
}

/* streak — consecutive days back from today (or yesterday if today isn't
   logged yet), with ONE auto-applied freeze (Duolingo, bounded slack): a
   single missed day inside the run gets covered retroactively — discovered
   as a gift, not spent as a choice. Max one per rolling week of the scan. */
function streakFor(id) {
  const log = readLog();
  const done = (d) => !!(log[d.toISOString().slice(0, 10)] || {})[id];
  let n = 0, d = new Date(), frozen = null, sinceFreeze = 99;
  if (!done(d)) d.setDate(d.getDate() - 1);
  for (;;) {
    if (done(d)) { n++; sinceFreeze++; d.setDate(d.getDate() - 1); continue; }
    // one covered miss, only inside a real run, never two within 7 days
    const prev = new Date(d); prev.setDate(prev.getDate() - 1);
    if (!frozen && n > 0 && sinceFreeze >= 7 && done(prev)) {
      frozen = d.toISOString().slice(0, 10);
      n++; sinceFreeze = 0; d.setDate(d.getDate() - 1);
      continue;
    }
    break;
  }
  return { n, frozen };
}

/* identity votes (Atoms): every completion this month is a vote for who
   you're becoming — the tally is what Donna narrates back. */
function votesThisMonth(id) {
  const log = readLog();
  const month = new Date().toISOString().slice(0, 7);
  return Object.keys(log).filter((day) => day.startsWith(month) && log[day][id]).length;
}

function list() {
  const today = new Date().toISOString().slice(0, 10);
  const log = readLog();
  return readHabits().filter(dueToday).map((h) => {
    const s = h.keystone ? streakFor(h.id) : null;
    return {
      ...h, doneToday: !!(log[today] && log[today][h.id]),
      streak: s ? s.n : undefined, frozen: s ? s.frozen : undefined,
      votes: h.identity ? votesThisMonth(h.id) : undefined,
    };
  });
}
function toggle(id) {
  const today = new Date().toISOString().slice(0, 10);
  const log = readLog();
  log[today] = log[today] || {};
  log[today][id] = !log[today][id];
  writeLog(log);
  return log[today][id];
}

module.exports = { list, toggle, votesThisMonth };
