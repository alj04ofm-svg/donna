/* Time-blocking — a greedy interval-packer. Places open tasks into the free
   slots of the working day, flowing around fixed calendar events, ordered by
   priority then due date. Pure logic; the Plan view renders the result. */

function minutesFromMidnight(iso) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function estimateMin(t) {
  if (t.estimatedMinutes) return t.estimatedMinutes;
  return t.priority === 1 ? 60 : t.priority === 2 ? 45 : 30; // sensible default by priority
}

function plan(tasks, events, opts = {}) {
  const dayStart = opts.startHour != null ? opts.startHour : 9;
  const dayEnd = opts.endHour != null ? opts.endHour : 19;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const busy = (events || []).filter((e) => !e.allDay).map((e) => ({
    s: minutesFromMidnight(e.start), e: minutesFromMidnight(e.end), title: e.title || "Busy", kind: "event",
  })).filter((b) => b.e > b.s).sort((a, b) => a.s - b.s);

  const endCap = dayEnd * 60;
  let cursor = Math.max(dayStart * 60, nowMin); // don't schedule in the past

  const open = tasks.filter((t) => t.status !== "done" && !t.waitingOn)
    .sort((a, b) => (a.priority - b.priority) || String(a.dueAt || "z").localeCompare(String(b.dueAt || "z")));

  /* A task is BLOCKED when any task it depends on is still open. Blocked work
     is deliberately not time-blocked — Motion-style: you can't start it, so it
     doesn't get a slot; it's surfaced as "blocked" instead of silently planned. */
  const openIds = new Set(tasks.filter((t) => t.status !== "done").map((t) => t.id));
  const isBlocked = (t) => Array.isArray(t.dependsOn) && t.dependsOn.some((id) => openIds.has(id));
  const schedulable = open.filter((t) => !isBlocked(t));
  const blocked = open.length - schedulable.length;

  const findSlot = (need, from) => {
    let c = from;
    while (c + need <= endCap) {
      const conflict = busy.find((b) => b.s < c + need && b.e > c);
      if (!conflict) return c;
      c = conflict.e; // jump past the event
    }
    return null;
  };

  const blocks = [];
  let overflow = 0;
  for (const t of schedulable) {
    const need = estimateMin(t);
    const slot = findSlot(need, cursor);
    if (slot === null) { overflow++; continue; }
    blocks.push({ id: t.id, title: t.title, priority: t.priority, project_id: t.project_id, s: slot, e: slot + need, doing: t.status === "doing" });
    cursor = slot + need;
  }

  const busyMin = busy.reduce((n, b) => n + (Math.min(b.e, endCap) - Math.max(b.s, dayStart * 60)), 0);
  const plannedMin = blocks.reduce((n, b) => n + (b.e - b.s), 0);
  const free = Math.max(0, Math.round((endCap - dayStart * 60 - busyMin - plannedMin) / 60));

  return { blocks, busy, dayStart, dayEnd, nowMin, overflow, planned: blocks.length, blocked, free };
}

module.exports = { plan, estimateMin, minutesFromMidnight };
