/* capacity.js — Forecast. 3 weeks ahead. Hours committed per day vs
   cfg.capacityHours (default 6h). Per-day load from task estimates
   and scheduled posting times. Returns a 21-day matrix. */

const tasks = require("./tasks");
const { dataPath } = require("./paths");
const cfg = require("./appConfig");
const schedule = require("./schedule");

const POSTING_FILE = dataPath("posting_queue.json");
const fs = require("node:fs");

function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; } }

function load21Days() {
  /* day 0 = today, 1..20 forward */
  const cfgData = (() => { try { return cfg.load(); } catch { return { capacityHours: 6 }; } })();
  const cap = cfgData.capacityHours || 6;
  const open = tasks.summary().open;
  const posting = readJson(POSTING_FILE, []);
  const days = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    /* load: tasks with due that day */
    const dueTasks = open.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === iso);
    const dueMin = dueTasks.reduce((n, t) => n + (t.estimatedMinutes || 60), 0);
    /* posts scheduled that day */
    const posts = (Array.isArray(posting) ? posting : []).filter((p) => (p.scheduled || "").slice(0, 10) === iso);
    /* weekdays = 1× capacity, weekend = 0.5× (lighter) */
    const eff = isWeekend ? cap * 0.5 : cap;
    days.push({
      date: iso, dow, isWeekend,
      due: dueTasks.map((t) => ({ id: t.id, title: t.title, pri: t.priority, min: t.estimatedMinutes || 60 })),
      dueMin, posts: posts.length, effHours: eff, loadHrs: dueMin / 60,
      pct: eff > 0 ? Math.min(150, Math.round((dueMin / 60 / eff) * 100)) : 0,
    });
  }
  return { days, capacity: cap };
}

module.exports = { load21Days };
