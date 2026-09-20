/* briefing.js — Friday briefing, on-demand. Aggregates week-over-week data
   from Activity, Goals, Tasks, Waiting, then asks M3 to write the executive
   summary. Saves the result as a Note for later review.

   The M3 prompt is kept terse + structured so the output is consistent. */

const fs = require("node:fs");
const path = require("node:path");
const activity = require("./activity");
const goals = require("./goals");
const tasks = require("./tasks");
const waiting = require("./waiting");
const sleep = require("./sleep");
const notes = require("./notes");
const { askMinimax } = require("./models/minimax");

const SYSTEM = `You are Donna, a sharp executive personal assistant. Write a terse,
no-fluff weekly briefing in your own voice. Use the data below — every claim
must be grounded in it. If you don't know something, say "no data". Lead with
the headline. No bullet walls. No "I" / "Here's". Numbers over adjectives.`;

function weekRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 7);
  return { since: start.toISOString(), until: end.toISOString() };
}

async function gather() {
  const { since, until } = weekRange();
  const a = activity.grouped({ since: new Date(since).getTime() });
  const t = tasks.summary();
  const g = goals.list().filter((x) => !x.done);
  const w = waiting.list();
  const avgSleep = sleep.average();
  /* roll up activity by kind */
  const byKind = {};
  for (const day of a) for (const it of day.items) byKind[it.kind] = (byKind[it.kind] || 0) + 1;
  /* week-over-week shift */
  const prevStart = new Date(since); prevStart.setDate(prevStart.getDate() - 7);
  const prev = activity.grouped({ since: prevStart.getTime(), until: new Date(since).getTime() });
  const prevByKind = {};
  for (const day of prev) for (const it of day.items) prevByKind[it.kind] = (prevByKind[it.kind] || 0) + 1;
  const shift = {};
  for (const k of new Set([...Object.keys(byKind), ...Object.keys(prevByKind)])) {
    shift[k] = (byKind[k] || 0) - (prevByKind[k] || 0);
  }
  return {
    weekStart: since.slice(0, 10),
    weekEnd: until.slice(0, 10),
    tasksDone: t.done.length,
    tasksDoneThisWeek: t.done.filter((x) => (x.completedAt || x.updatedAt) >= since).length,
    tasksWontDo: t.wontdo.length,
    tasksWontDoThisWeek: t.wontdo.filter((x) => (x.completedAt || x.updatedAt) >= since).length,
    byKind, shift,
    openTasks: t.open.length,
    p1Open: t.counts.p1,
    goals: g.map((x) => ({ objective: x.objective || x.title, pct: x.pct, cycleWeek: x.cycleWeek, cycleDaysLeft: x.cycleDaysLeft, oneThing: x.oneThing, week: x.week })),
    waiting: w.length,
    waitingAlert: w.filter((x) => x.alert).length,
    waitingStale: w.filter((x) => x.stale && !x.alert).length,
    avgSleepHours7d: avgSleep ? Number(avgSleep.toFixed(1)) : null,
  };
}

function render(g) {
  const lines = [];
  lines.push(`# Weekly briefing — ${g.weekStart} to ${g.weekEnd}\n`);
  lines.push(`## Headline\n`);
  lines.push(`- ${g.tasksDoneThisWeek} tasks shipped · ${g.p1Open} P1s open · ${g.waitingAlert} partner alerts.\n`);
  lines.push(`## Goals\n`);
  if (!g.goals.length) lines.push(`- No active goals this cycle.\n`);
  for (const goal of g.goals) {
    const w = goal.week || {};
    lines.push(`- **${goal.objective}** — ${goal.pct}% (week ${goal.cycleWeek || "?"} of 12, ${goal.cycleDaysLeft || "?"}d left). Lead: ${goal.oneThing || "(none)"}. This week: ${w.done || 0}/${w.committed || 0}.\n`);
  }
  lines.push(`## Tasks\n`);
  lines.push(`- Shipped: ${g.tasksDoneThisWeek} this week vs ${g.tasksDone - g.tasksDoneThisWeek} prior.\n`);
  lines.push(`- Won't do: ${g.tasksWontDoThisWeek} this week (intentional abandonment).\n`);
  lines.push(`- Open: ${g.openTasks}, of which ${g.p1Open} P1.\n`);
  lines.push(`## People\n`);
  lines.push(`- Waiting on: ${g.waiting} (${g.waitingAlert} alert, ${g.waitingStale} stale).\n`);
  if (g.avgSleepHours7d) lines.push(`## Body\n- Sleep avg: ${g.avgSleepHours7d}h.\n`);
  lines.push(`\n## Raw data\n\`\`\`json\n${JSON.stringify(g, null, 2)}\n\`\`\`\n`);
  return lines.join("");
}

async function generate({ tier = "quick" } = {}) {
  const data = await gather();
  const prompt = `${tier}: ${SYSTEM}\n\nDATA (JSON):\n${JSON.stringify(data, null, 2)}\n\nWrite a 6-8 line executive briefing. Headline first. Then 3-4 short paragraphs: goal pace, task throughput, partner/health flags, one line on what to focus next week. No bullet walls. Numbers over adjectives. End with "—" + a 1-line forward-looking note.`;
  let body = "";
  try { body = await askMinimax(prompt, { system: SYSTEM, maxTokens: 800, temperature: 0.3 }); } catch (e) { body = `(brain unavailable: ${e.message})`; }
  const full = render(data) + "\n## AI summary\n\n" + body + "\n";
  /* save as a Note */
  try {
    const title = `Briefing — ${data.weekStart} to ${data.weekEnd}`;
    notes.add(title, full);
  } catch {}
  return { data, body, full, title: `Briefing — ${data.weekStart} to ${data.weekEnd}` };
}

module.exports = { generate, gather, render };
