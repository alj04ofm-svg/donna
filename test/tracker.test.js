const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

/* analytics-only test: write a synthetic past day, read it back through
   computeDay, assert the math. No live capture involved. */
const { TRACKER: DATA } = require("../src/lib/paths");
const DAY = "2020-01-01"; // safely in the past, never collides with a real day
const F = path.join(DATA, `${DAY}.events.json`);

const T0 = Math.floor(new Date(`${DAY}T09:00:00Z`).getTime() / 1000);

function writeDay() {
  fs.mkdirSync(DATA, { recursive: true });
  const events = [
    // 30 min in Cursor (Dev & AI, +2) — one merged event
    { s: T0, d: 1800, app: "Cursor", title: "tracker.js — donna-v2", url: null },
    // 10 min Instagram feed (Social feeds, −2)
    { s: T0 + 1800, d: 600, app: "Arc", title: "Instagram", url: "https://instagram.com/" },
    // 40 min Higgsfield (Creative, +2), but 10 min of it is AFK-masked
    { s: T0 + 2400, d: 2400, app: "Arc", title: "Higgsfield", url: "https://higgsfield.ai/create" },
  ];
  const afk = [{ s: T0 + 3600, e: T0 + 4200 }]; // 10 min away inside the Higgsfield block
  fs.writeFileSync(F, JSON.stringify({ date: DAY, events, afk, shots: [], voiceToday: 3 }));
}

test("computeDay: AFK masking, categories, pulse, focus sessions", () => {
  writeDay();
  const tracker = require("../src/lib/tracker");
  const c = tracker.computeDay(DAY);

  // 30 + 10 + (40 − 10 AFK) = 70 active minutes
  assert.equal(c.activeMin, 70);

  const cats = Object.fromEntries(c.cats.map((x) => [x.cat, x.min]));
  assert.equal(cats["Dev & AI"], 30);
  assert.equal(cats["Social feeds"], 10);
  assert.equal(cats["Creative"], 30);

  // pulse: (60min·level4 + 10min·level0) / (70·4) = 240/280 ≈ 86
  assert.ok(Math.abs(c.pulse - 86) <= 1, `pulse ${c.pulse}`);

  // first 30-min Cursor run is a focus session; the IG break kills the second
  // run's purity only if contiguous — the AFK gap splits Higgsfield anyway
  assert.ok(c.focusCount >= 1, `focusCount ${c.focusCount}`);
  assert.ok(c.deepMin >= 30, `deepMin ${c.deepMin}`);

  assert.equal(c.voiceToday, 3);
  assert.equal(c.appOnly, false);
  fs.unlinkSync(F);
});
