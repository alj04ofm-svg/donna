const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");

/* macOS Calendar reader for Today's events.
   Shells out to `osascript -l JavaScript` (JXA) and queries EventKit's
   predicateForEventsWithStartDateEndDateCalendars directly, bounded to
   today 00:00 -> tomorrow 00:00. This is deliberately NOT plain AppleScript
   (`tell application "Calendar" to ... whose start date >= ...`) — that
   "whose" filter has to evaluate the predicate per-event over Apple Events,
   and on this machine one shared/subscribed calendar ("Combined") hangs
   30s+ on it every time, with no way to interrupt from inside the script
   (AppleScript's own `with timeout of` block does not abort a stuck Apple
   Event to Calendar.app — confirmed by testing, a known macOS limitation).
   EventKit's predicate query is a real indexed lookup against the calendar
   database, so it returns in well under a second regardless. */

const TIMEOUT_MS = 8000;
const FS_SEP = ""; // field separator, won't collide with real text

const SCRIPT = `
ObjC.import('EventKit');
ObjC.import('Foundation');

const FS = "\\u001f";
const store = $.EKEventStore.alloc.init;
// authorizationStatusForEntityType comes back as a boxed JXA value (typeof
// "string") that prints like a number but fails strict ===/!== against a JS
// number — Number(...) it first or every comparison below silently lies.
const status = Number($.EKEventStore.authorizationStatusForEntityType($.EKEntityTypeEvent));
// 3 = authorized (pre-Sequoia), 4 = fullAccess (Sequoia+). Anything else = no access.
if (status !== 3 && status !== 4) {
  console.log("PERM_DENIED");
} else {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const nsStart = $.NSDate.dateWithTimeIntervalSince1970(start.getTime() / 1000);
  const nsEnd = $.NSDate.dateWithTimeIntervalSince1970(end.getTime() / 1000);
  const predicate = store.predicateForEventsWithStartDateEndDateCalendars(nsStart, nsEnd, $());
  const events = store.eventsMatchingPredicate(predicate);
  console.log("OK");
  const n = events.count;
  for (let i = 0; i < n; i++) {
    const e = events.objectAtIndex(i);
    const title = String(ObjC.unwrap(e.title) || "(untitled)").replace(/[\\r\\n]+/g, " ");
    const calName = String(ObjC.unwrap(e.calendar.title) || "");
    const allDay = e.isAllDay ? "1" : "0";
    console.log([title, e.startDate.timeIntervalSince1970, e.endDate.timeIntervalSince1970, calName, allDay].join(FS));
  }
}
`;

function parseOutput(raw) {
  const lines = raw.split("\n").filter((l) => l.length > 0);
  if (lines[0] === "PERM_DENIED") return { events: [], ok: false, reason: "permission" };
  if (lines[0] !== "OK") return { events: [], ok: false, reason: "error" };
  const events = lines.slice(1).map((line) => {
    const [title, sSec, eSec, calName, allDay] = line.split(FS_SEP);
    return {
      title,
      start: new Date(parseFloat(sSec) * 1000).toISOString(),
      end: new Date(parseFloat(eSec) * 1000).toISOString(),
      calendar: calName,
      allDay: allDay === "1",
    };
  });
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return { events, ok: true };
}

function today() {
  let tmpFile;
  try {
    tmpFile = path.join(os.tmpdir(), `donna-calendar-${process.pid}-${Date.now()}.js`);
    fs.writeFileSync(tmpFile, SCRIPT);
    // JXA's console.log writes to stderr, not stdout (an osascript -l JavaScript
    // quirk) — merge streams so execSync actually captures it.
    const raw = execSync(`osascript -l JavaScript "${tmpFile}" 2>&1`, { timeout: TIMEOUT_MS, encoding: "utf8" });
    return parseOutput(raw);
  } catch (err) {
    if (err.killed || err.signal) return { events: [], ok: false, reason: "timeout" };
    return { events: [], ok: false, reason: "error" };
  } finally {
    if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch {} }
  }
}

function status() {
  const r = today();
  return r.ok ? { ok: true, count: r.events.length } : { ok: false, reason: r.reason, count: 0 };
}

module.exports = { today, status };
