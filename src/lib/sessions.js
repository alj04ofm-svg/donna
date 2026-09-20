const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Self-directed time tracking — the Hubstaff-equivalent, but Alex's own focus
   sessions, never surveillance. Every focus session (task → doing → done/pause)
   is logged here; the Rhythm view reads the stream. */

const FILE = dataPath("sessions.json");

function read() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } }
function write(a) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); }

function log({ taskId, title, start, end }) {
  if (!start) return 0;
  const mins = Math.round((new Date(end || Date.now()) - new Date(start)) / 60000);
  if (mins < 1) return 0; // ignore sub-minute blips
  const s = read();
  s.push({ id: `s_${Date.now()}`, taskId: taskId || null, title: title || "Focus", start, end: end || new Date().toISOString(), minutes: mins });
  write(s);
  return mins;
}

const dayKey = (iso) => (iso || "").slice(0, 10);
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function stats() {
  const s = read();
  const today = new Date().toISOString().slice(0, 10);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    week.push({ date: k, day: DOW[d.getDay()], minutes: s.filter((x) => dayKey(x.end) === k).reduce((n, x) => n + x.minutes, 0) });
  }
  const todaySessions = s.filter((x) => dayKey(x.end) === today).sort((a, b) => new Date(b.end) - new Date(a.end));
  // per-day focused minutes for a date key
  const minsOn = (k) => s.filter((x) => dayKey(x.end) === k).reduce((n, x) => n + x.minutes, 0);
  // 14-day dot row (met = a real focused day) + current streak, ending today
  const FLOOR = 60; // minutes = "a focused day"
  const dots = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); dots.push({ date: k, met: minsOn(k) >= FLOOR }); }
  let streak = 0;
  for (let i = 0; ; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (minsOn(d.toISOString().slice(0, 10)) >= FLOOR) streak++; else break; }
  // best time-of-day bucket (trailing history)
  const buckets = { Morning: 0, Afternoon: 0, Evening: 0 };
  for (const x of s) { const h = new Date(x.start).getHours(); buckets[h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening"] += x.minutes; }
  const best = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
  // longest single session today (a personal-best callout)
  const longest = todaySessions.reduce((mx, x) => (x.minutes > (mx?.minutes || 0) ? x : mx), null);
  // 4-week daily average, for the chart's self-baseline
  let past = 0; for (let i = 0; i < 28; i++) { const d = new Date(); d.setDate(d.getDate() - i); past += minsOn(d.toISOString().slice(0, 10)); }
  const dayAvg = Math.round(past / 28);
  return {
    todayMin: week[6].minutes,
    weekMin: week.reduce((n, x) => n + x.minutes, 0),
    week, dots, streak, dayAvg,
    bestTime: best && best[1] > 0 ? best[0] : null,
    longest: longest ? { minutes: longest.minutes, title: longest.title } : null,
    todaySessions: todaySessions.slice(0, 12),
    total: s.length,
  };
}

module.exports = { log, stats };
