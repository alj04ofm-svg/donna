/* diagnostic.js — silent-issue radar. Runs at first open of the day.
   Catches the things that rot without you noticing: tracker permission
   missing, no focus session in 4 days, 3+ stale waitings, a goal with no
   weekly commit in 7 days, a routine habit not done in 2 days, etc.
   Returns a list of severity-sorted issues for the Today card. */

const fs = require("node:fs");
const path = require("node:path");
const tasks = require("./tasks");
const waiting = require("./waiting");
const goals = require("./goals");
const habits = require("./habits");
const sessions = require("./sessions");

const SEVERITY = { info: 0, warn: 1, alert: 2 };

function run({ trackerConfig, permStatus, cfg } = {}) {
  const issues = [];

  try {
    /* tracker permission */
    if (permStatus && permStatus.screen !== "granted") {
      issues.push({ id: "tracker.perm", severity: "warn", icon: "⚠",
        title: "Tracker permission not granted",
        body: "Donna can't capture focus evidence until you grant Electron Screen Recording.",
        action: { goto: "settings", tab: "permissions" } });
    }
  } catch {}

  try {
    /* no focus session in 4 days */
    const recent = sessions.stats();
    if (recent.lastSessionAt) {
      const days = (Date.now() - new Date(recent.lastSessionAt).getTime()) / 86400000;
      if (days > 4) {
        issues.push({ id: "tracker.no_focus", severity: "info", icon: "◷",
          title: `No focus session in ${Math.floor(days)}d`,
          body: "Start a focus block to keep your lead-measure honest." });
      }
    } else {
      issues.push({ id: "tracker.never_focused", severity: "info", icon: "◷",
        title: "No focus sessions yet",
        body: "Press D on any task to start one." });
    }
  } catch {}

  try {
    /* stale waitings (anyone, not just George) */
    const wlist = waiting.list();
    const alert = wlist.filter((w) => w.alert).length;
    if (alert > 0) {
      issues.push({ id: "waiting.alert", severity: "alert", icon: "⏳",
        title: `${alert} thing${alert > 1 ? "s" : ""} past alert threshold`,
        body: "Hand-offs that need a nudge today.",
        action: { kind: "waiting" } });
    }
  } catch {}

  try {
    /* goals with no weekly commit in 7+ days */
    const allGoals = goals.list();
    const stale = allGoals.filter((g) => !g.done && (!g.week || !g.week.at || (Date.now() - new Date(g.week.at).getTime()) / 86400000 > 7));
    if (stale.length > 0) {
      issues.push({ id: "goals.no_commit", severity: "warn", icon: "◎",
        title: `${stale.length} goal${stale.length > 1 ? "s" : ""} haven't been logged this week`,
        body: stale.map((g) => g.objective || g.title).join(" · ").slice(0, 100),
        action: { goto: "goals" } });
    }
  } catch {}

  try {
    /* habits overdue */
    const hlist = habits.list();
    const due = hlist.filter((h) => h.dueToday && !h.doneToday);
    if (due.length >= 3) {
      issues.push({ id: "habits.overdue", severity: "info", icon: "✦",
        title: `${due.length} habits still to check off`,
        body: due.map((h) => h.label || h.name).slice(0, 4).join(" · "),
        action: { goto: "today" } });
    }
  } catch {}

  try {
    /* stale tasks (open > 30 days) */
    const open = tasks.summary().open;
    const ancient = open.filter((t) => t.updatedAt && (Date.now() - new Date(t.updatedAt).getTime()) / 86400000 > 30);
    if (ancient.length > 0) {
      issues.push({ id: "tasks.stale", severity: "info", icon: "◌",
        title: `${ancient.length} task${ancient.length > 1 ? "s" : ""} open > 30 days`,
        body: ancient.slice(0, 3).map((t) => t.title).join(" · "),
        action: { goto: "tasks" } });
    }
  } catch {}

  /* sort by severity desc */
  issues.sort((a, b) => (SEVERITY[b.severity] || 0) - (SEVERITY[a.severity] || 0));
  return { issues, runAt: new Date().toISOString() };
}

module.exports = { run };
