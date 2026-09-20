const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");
const tasks = require("./tasks");

/* Waiting-On — the follow-up ledger for anything blocked on OTHER people.
   Merges standing items (data/waiting.json) with any task carrying a
   waitingOn flag. Per-person thresholds because partners are tighter than
   vendors: George is a partner → 12h stale, 48h alert. Anyone else → 3d
   stale, 7d alert. Override per-person via PEOPLE_THRESHOLDS. */

const FILE = dataPath("waiting.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); } catch {} };

/* hours thresholds. Default = external vendor. Overrides per person. */
const DEFAULT_STALE_HRS = 72;
const DEFAULT_ALERT_HRS = 168;
const PEOPLE_THRESHOLDS = {
  george: { stale: 12, alert: 48 },
  /* add more partners here: "alex": { stale: 4, alert: 24 } */
};
function thresholds(who) {
  const k = String(who || "").toLowerCase();
  return PEOPLE_THRESHOLDS[k] || { stale: DEFAULT_STALE_HRS, alert: DEFAULT_ALERT_HRS };
}

function list() {
  const standing = read().filter((x) => !x.resolvedAt)
    .map((x) => ({ id: x.id, item: x.item, who: x.who, since: x.since, kind: "standing" }));
  let taskItems = [];
  try {
    taskItems = tasks.summary().open.filter((t) => t.waitingOn)
      .map((t) => ({ id: t.id, item: t.title, who: t.waitingOn, since: t.updatedAt, kind: "task" }));
  } catch {}
  return [...taskItems, ...standing].map((x) => {
    const hrs = x.since ? Math.floor((Date.now() - new Date(x.since)) / 3600000) : 0;
    const t = thresholds(x.who);
    return {
      ...x,
      hrs,
      days: Math.floor(hrs / 24),
      stale: hrs >= t.stale,
      alert: hrs >= t.alert,
      thresholdHrs: t.stale,
      alertHrs: t.alert,
    };
  }).sort((a, b) => b.hrs - a.hrs);
}

/* Summary for the Today rollup: count of stale + alert items. */
function rollup() {
  const all = list();
  return {
    total: all.length,
    stale: all.filter((x) => x.stale && !x.alert).length,
    alert: all.filter((x) => x.alert).length,
    george: all.filter((x) => String(x.who || "").toLowerCase() === "george").length,
  };
}

function add(item, who) {
  if (!item) return;
  const a = read();
  a.push({ id: `w_${Date.now()}`, item: String(item).slice(0, 200), who: (who || "").slice(0, 60), since: new Date().toISOString(), resolvedAt: null });
  write(a);
}
function resolve(id) { const a = read(); const x = a.find((w) => w.id === id); if (x) x.resolvedAt = new Date().toISOString(); write(a); }

module.exports = { list, add, resolve, rollup, thresholds, PEOPLE_THRESHOLDS };
