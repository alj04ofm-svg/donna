/* patterns.js — small analytics. Computes hour-of-day and day-of-week
   focus patterns from sessions.json + an interruption counter from
   activity feed. Surfaced in Tracker. */

const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");
const sessions = require("./sessions");
const activity = require("./activity");

/* hour-of-day focus distribution (24 buckets, minutes) */
function focusByHour(days = 30) {
  const since = Date.now() - days * 86400000;
  const log = (() => { try { return JSON.parse(fs.readFileSync(dataPath("sessions.json"), "utf8")); } catch { return []; } })();
  const buckets = Array(24).fill(0);
  for (const s of log) {
    if (!s.start || !s.end) continue;
    const t0 = new Date(s.start).getTime();
    const t1 = new Date(s.end).getTime();
    if (t1 < since) continue;
    /* bucket by hour, proportional */
    for (let t = t0; t < t1; t += 60000) {
      const h = new Date(t).getHours();
      buckets[h] += 1;
    }
  }
  return buckets;
}

/* day-of-week focus distribution (7 buckets) */
function focusByDay(days = 30) {
  const since = Date.now() - days * 86400000;
  const log = (() => { try { return JSON.parse(fs.readFileSync(dataPath("sessions.json"), "utf8")); } catch { return []; } })();
  const buckets = Array(7).fill(0);
  for (const s of log) {
    if (!s.start || !s.end) continue;
    const t = new Date(s.start).getTime();
    if (t < since) continue;
    const d = new Date(s.start).getDay();
    buckets[d] += Math.max(0, Math.round((new Date(s.end).getTime() - t) / 60000));
  }
  return buckets;
}

/* interruption cost — how many notification-like events hit you today.
   Heuristic: activity items of kind task_added, task_done, note_added,
   idea_added, capture, etc — Donna-generated events, not your own. */
function interruptionsToday() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const items = activity.list({ since: today.getTime(), limit: 200 });
  return items.filter((e) => /donna|capture|nudge|alert|reminder|notification/i.test(e.kind + " " + (e.summary || ""))).length;
}

/* "You ship more on Mondays" — best hour + best day */
function peak() {
  const h = focusByHour(60);
  const max = Math.max(...h);
  const hour = max > 0 ? h.indexOf(max) : null;
  const d = focusByDay(60);
  const dmax = Math.max(...d);
  const day = dmax > 0 ? d.indexOf(dmax) : null;
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    bestHour: hour != null ? `${hour}:00` : null,
    bestHourMin: max,
    bestDay: day != null ? DAY[day] : null,
    bestDayMin: dmax,
  };
}

module.exports = { focusByHour, focusByDay, interruptionsToday, peak };
