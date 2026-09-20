/* activity.js — the append-only log of everything that happens in Donna.
   The "what did I do this week" history, browsable by day, domain, type.
   Each entry: { id, at, kind, domain, summary, ref?, payload? }
     kind: task_done | task_wontdo | task_added | goal_added | goal_reached |
           goal_reopened | goal_week | person_touched | person_added |
           note_added | idea_added | capture_added | focus_session |
           reminder_fired | memory_added | routine_checked | replacement_done
   Append-only — never mutate entries. "What we did and can always go back to."
   Powers the Activity view (palette: "Activity"). */

const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");
const FILE = dataPath("activity.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); } catch {} };
const uid = () => `a_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

const DOMAINS = ["work", "money", "health", "relationships"];

function log(kind, summary, opts = {}) {
  if (!kind) return null;
  const a = read();
  const entry = {
    id: uid(),
    at: new Date().toISOString(),
    kind: String(kind).slice(0, 32),
    domain: DOMAINS.includes(opts.domain) ? opts.domain : (opts.domain || null),
    summary: String(summary || "").slice(0, 240),
    ref: opts.ref || null,
    payload: opts.payload || null,
  };
  a.push(entry);
  // cap at 10k entries (~3 years of dense activity) so the file stays tiny
  if (a.length > 10000) a.splice(0, a.length - 10000);
  write(a);
  return entry;
}

/* Time-range query. start/end are millis. */
function list({ since, until, kinds, domains, limit = 500 } = {}) {
  let a = read();
  if (since) a = a.filter((e) => new Date(e.at).getTime() >= since);
  if (until) a = a.filter((e) => new Date(e.at).getTime() <= until);
  if (kinds && kinds.length) a = a.filter((e) => kinds.includes(e.kind));
  if (domains && domains.length) a = a.filter((e) => e.domain && domains.includes(e.domain));
  return a.slice(-limit).reverse();
}

/* Per-day bucketing — the visual grouping. Returns [{ day: 'YYYY-MM-DD', items: [...] }]. */
function grouped({ since, until, kinds, domains } = {}) {
  const items = list({ since, until, kinds, domains, limit: 2000 });
  const byDay = new Map();
  for (const e of items) {
    const d = (e.at || "").slice(0, 10);
    if (!d) continue;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(e);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({ day, items }));
}

/* one-time backfill from existing data so the view isn't empty on first run.
   Idempotent — guards with a marker on the latest entry. */
function backfill() {
  const a = read();
  if (a.find((e) => e._backfill)) return 0;
  let n = 0;
  try {
    const tdata = JSON.parse(fs.readFileSync(dataPath("tasks.json"), "utf8"));
    for (const t of (tdata.tasks || [])) {
      if (t.status === "done" && t.completedAt) {
        a.push({ id: uid(), at: t.completedAt, kind: "task_done", domain: domainOfTask(t),
          summary: t.title, ref: { type: "task", id: t.id } });
        n++;
      } else if (t.wontDo && t.updatedAt) {
        a.push({ id: uid(), at: t.updatedAt, kind: "task_wontdo", domain: domainOfTask(t),
          summary: t.title + (t.wontDoReason ? ` — ${t.wontDoReason}` : ""), ref: { type: "task", id: t.id } });
        n++;
      }
    }
  } catch {}
  try {
    const gfile = dataPath("goals.json");
    const gs = JSON.parse(fs.readFileSync(gfile, "utf8"));
    for (const g of gs) {
      if (g.createdAt) {
        a.push({ id: uid(), at: g.createdAt, kind: "goal_added", domain: g.domain,
          summary: g.objective || g.title || "New goal", ref: { type: "goal", id: g.id } });
        n++;
      }
      if (g.week && g.week.at) {
        a.push({ id: uid(), at: g.week.at, kind: "goal_week", domain: g.domain,
          summary: `${g.objective || g.title} — ${g.week.done}/${g.week.committed} this week`,
          ref: { type: "goal", id: g.id } });
        n++;
      }
    }
  } catch {}
  a.push({ id: uid(), at: new Date().toISOString(), kind: "system", domain: null, summary: "backfill complete", _backfill: true });
  a.sort((x, y) => String(x.at).localeCompare(String(y.at)));
  write(a);
  return n;
}

function domainOfTask(t) {
  if (t.area && DOMAINS.includes(t.area)) return t.area;
  // project_id is a track — bucket under work unless explicit
  return "work";
}

/* Roll-up counts for the header chip on the Activity page. */
function rollup(since) {
  const a = list({ since, limit: 5000 });
  const byKind = {};
  for (const e of a) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  return { total: a.length, byKind };
}

module.exports = { log, list, grouped, backfill, rollup, DOMAINS };
