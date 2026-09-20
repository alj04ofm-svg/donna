"use strict";

const fs = require("node:fs");
const { dataPath } = require("./paths");
const tasks = require("./tasks");

/* Always-synced layer: watch the local task store and surface meaningful
   transitions (new task, new P1) so Donna can nudge instead of the user
   polling. */

const WATCH = [dataPath("tasks.json")];

function snap() {
  let t = { counts: {} };
  try {
    t = tasks.summary();
  } catch {}
  return { open: t.counts.open || 0, p1: t.counts.p1 || 0 };
}

function createWatchers({ onEvent }) {
  let prev = snap();
  let timer = null;
  const check = () => {
    const cur = snap();
    const ev = [];
    if (cur.open > prev.open) ev.push({ title: "New task", body: `${cur.open - prev.open} added to your board`, alert: false });
    if (cur.p1 > prev.p1) ev.push({ title: "New priority task", body: `${cur.p1 - prev.p1} high-priority added`, alert: true });
    prev = cur;
    ev.forEach((e) => onEvent(e));
  };
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(check, 1500);
  };
  const handles = [];
  for (const p of WATCH) {
    try {
      handles.push(fs.watch(p, { persistent: false }, debounced));
    } catch {
      /* file may not exist yet */
    }
  }
  return {
    stop: () =>
      handles.forEach((h) => {
        try {
          h.close();
        } catch {}
      }),
  };
}

module.exports = { createWatchers, snap };
