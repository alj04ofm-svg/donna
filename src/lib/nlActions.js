"use strict";

/* nlActions.js — plain-language task commands, executed locally with NO model
   call. Motion's AI Chat can "create or update tasks using plain language";
   this is the practical, offline version for the commands a personal assistant
   actually gets asked. Runs before the AI in brain.ask, so "complete the invoice"
   is instant and deterministic. Returns null when the text isn't a command. */

const tasks = require("./tasks");

function findOpen(text) {
  const q = String(text || "").toLowerCase().trim().replace(/^["']|["']$/g, "");
  if (!q) return null;
  const open = tasks.summary().open;
  let best = null, bestScore = 0;
  for (const t of open) {
    const title = String(t.title || "").toLowerCase();
    let score = 0;
    if (title === q) score = 200;
    else if (title.includes(q)) score = 80 + q.length;
    else {
      const words = q.split(/\s+/).filter((w) => w.length > 3);
      const hits = words.filter((w) => title.includes(w)).length;
      if (words.length && hits) score = hits * 20;
    }
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return bestScore >= 20 ? best : null;
}

const isoOffset = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const isoToday = () => new Date().toISOString().slice(0, 10);

function parseDatePhrase(p) {
  const s = String(p || "").toLowerCase().trim();
  if (/today|tonight/.test(s)) return isoToday();
  if (/tomorrow|tmrw|tmw/.test(s)) return isoOffset(1);
  if (/next week/.test(s)) return isoOffset(7);
  if (/next month/.test(s)) return isoOffset(30);
  if (/weekend/.test(s)) { const d = new Date(); const diff = (6 - d.getDay() + 7) % 7 || 6; d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10); }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const i = days.findIndex((d) => s.includes(d));
  if (i >= 0) { const d = new Date(); let diff = (i - d.getDay() + 7) % 7; if (diff === 0) diff = 7; d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10); }
  const m = s.match(/in (\d+) days?/); if (m) return isoOffset(Number(m[1]));
  const iso = s.match(/(\d{4}-\d{2}-\d{2})/); if (iso) return iso[1];
  return null;
}

/* Returns { handled, message, refresh } or null if not a recognized command. */
function run(text) {
  const s = String(text || "").trim();
  if (!s || s.length > 200) return null;
  let m;

  // "roll all overdue to today" / "snooze overdue"
  if (/^(?:roll|move|snooze|reschedule)?\s*(?:all\s+)?overdue(?:\s+(?:to|into)\s+today)?\s*[.!]?$/i.test(s)) {
    const n = tasks.rolloverOverdue(isoToday());
    return { handled: true, message: n ? `Rolled ${n} overdue task${n === 1 ? "" : "s"} to today.` : "No overdue tasks — you're clear.", refresh: true };
  }
  // "complete <task>" / "finish <task>" / "mark <task> done"
  if ((m = s.match(/^(?:complete|finish|close|done with|mark)\s+(.+?)(?:\s+(?:as\s+)?done)?$/i))) {
    const t = findOpen(m[1]);
    if (!t) return { handled: true, message: `Couldn't find an open task matching "${m[1].trim()}".` };
    tasks.complete(t.id);
    return { handled: true, message: `Done — "${t.title}".`, refresh: true };
  }
  // "delete <task>" / "remove <task>"
  if ((m = s.match(/^(?:delete|remove|drop)\s+(?:the\s+)?(?:task\s+)?(.+)$/i))) {
    const t = findOpen(m[1]);
    if (!t) return { handled: true, message: `Couldn't find an open task matching "${m[1].trim()}".` };
    tasks.remove(t.id);
    return { handled: true, message: `Deleted "${t.title}".`, refresh: true };
  }
  // "reschedule all p1 to tomorrow"
  if ((m = s.match(/^(?:move|reschedule|push|snooze)\s+all\s+(p[1-4]|high|urgent|low)\s+to\s+(.+)$/i))) {
    const when = parseDatePhrase(m[2]);
    if (!when) return { handled: true, message: `I didn't understand the date "${m[2].trim()}".` };
    const pr = /^p[1-4]$/i.test(m[1]) ? Number(m[1][1]) : /high|urgent/i.test(m[1]) ? 1 : 3;
    let n = 0;
    for (const t of tasks.summary().open) if (t.priority === pr && t.status !== "doing") { tasks.setDue(t.id, when); n++; }
    return { handled: true, message: n ? `Moved ${n} P${pr} task${n === 1 ? "" : "s"} to ${when}.` : `No open P${pr} tasks to move.`, refresh: true };
  }
  // "move <task> to <date>"
  if ((m = s.match(/^(?:move|reschedule|push|snooze|set)\s+(.+?)\s+to\s+(.+)$/i))) {
    const when = parseDatePhrase(m[2]);
    if (!when) return { handled: true, message: `I didn't understand the date "${m[2].trim()}".` };
    const t = findOpen(m[1]);
    if (!t) return { handled: true, message: `Couldn't find an open task matching "${m[1].trim()}".` };
    tasks.setDue(t.id, when);
    return { handled: true, message: `Moved "${t.title}" to ${when}.`, refresh: true };
  }
  return null;
}

module.exports = { run, findOpen, parseDatePhrase };
