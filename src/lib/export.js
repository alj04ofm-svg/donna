/* export.js — Markdown export per surface. Goals → 1 page, Activity
   → 1 page, etc. Beautiful, human-readable, copy-paste friendly. */

const tasks = require("./tasks");
const goals = require("./goals");
const notes = require("./notes");
const activity = require("./activity");
const waiting = require("./waiting");
const decisions = require("./decisions");
const antigoals = require("./antigoals");

function mdHeading(t) { return `# ${t}\n\n`; }
function mdSection(t, body) { return `## ${t}\n\n${body}\n\n`; }
function mdItem(s) { return `- ${s}\n`; }

function exportGoals() {
  const all = goals.list();
  let out = mdHeading("Goals — " + new Date().toLocaleDateString());
  out += `*${all.length} goals · ${all.filter((g) => !g.done).length} active · ${all.filter((g) => g.done).length} reached*\n\n`;
  for (const g of all) {
    out += `### ${g.objective || g.title}\n\n`;
    out += `*${g.domain} · ${g.horizon} · ${g.pct}% · cycle week ${g.cycleWeek}/12 · ${g.cycleDaysLeft}d left*\n\n`;
    if (g.why) out += `> ${g.why}\n\n`;
    if (g.oneThing) out += `**One thing**: ${g.oneThing}\n\n`;
    if (g.keyResults && g.keyResults.length) {
      out += `**Key results**\n\n`;
      for (const k of g.keyResults) out += mdItem(`${k.text} — ${k.current || 0}/${k.target}${k.unit ? " " + k.unit : ""}`);
      out += "\n";
    }
    if (g.milestones && g.milestones.length) {
      out += `**Milestones**\n\n`;
      for (const m of g.milestones) out += mdItem(`${m.done ? "✓" : "○"} ${m.text}`);
      out += "\n";
    }
    if (g.week) out += `**This week**: ${g.week.done}/${g.week.committed} committed actions done.\n\n`;
    out += "---\n\n";
  }
  return out;
}

function exportActivity(days = 30) {
  const since = Date.now() - days * 86400000;
  const groups = activity.grouped({ since, limit: 500 });
  let out = mdHeading(`Activity — last ${days} days`);
  out += `*${groups.length} days · ${groups.reduce((n, g) => n + g.items.length, 0)} events*\n\n`;
  for (const { day, items } of groups) {
    const d = new Date(day + "T12:00:00");
    out += `### ${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}\n\n`;
    for (const it of items) {
      const time = new Date(it.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      out += mdItem(`${time} — ${it.summary}`);
    }
    out += "\n";
  }
  return out;
}

function exportPeople() {
  const out = mdHeading("People — " + new Date().toLocaleDateString());
  out += "*WIP*\n\n";
  return out;
}

function exportNotes() {
  const all = notes.list();
  let out = mdHeading("Notes — " + new Date().toLocaleDateString());
  out += `*${all.length} notes*\n\n`;
  for (const n of all) {
    out += `### ${n.title}\n\n${n.body}\n\n---\n\n`;
  }
  return out;
}

function exportWaiting() {
  const w = waiting.list();
  let out = mdHeading("Waiting on — " + new Date().toLocaleDateString());
  out += `*${w.length} hand-offs · ${w.filter((x) => x.alert).length} alert · ${w.filter((x) => x.stale).length} stale*\n\n`;
  for (const x of w) out += mdItem(`**${x.item}** — on ${x.who || "someone"} · ${x.hrs}h ${x.alert ? "(alert)" : x.stale ? "(stale)" : ""}`);
  return out;
}

function exportLog() {
  const decs = decisions.list();
  const ants = antigoals.list();
  let out = mdHeading("Log — " + new Date().toLocaleDateString());
  out += mdSection("Decisions", decs.length ? decs.map((d) => mdItem(`**${d.title}** — ${d.why || "—"}${d.who ? ` (${d.who})` : ""}`)).join("") : "—\n");
  out += mdSection("Anti-goals", ants.length ? ants.map((a) => mdItem(`**${a.rule}** — ${a.why || "—"}`)).join("") : "—\n");
  return out;
}

function exportAll() {
  return [exportGoals(), exportActivity(30), exportWaiting(), exportLog(), exportNotes()].join("\n\n---\n\n");
}

const SURFACES = {
  goals: exportGoals,
  activity: () => exportActivity(30),
  people: exportPeople,
  notes: exportNotes,
  waiting: exportWaiting,
  log: exportLog,
  all: exportAll,
};

module.exports = SURFACES;
