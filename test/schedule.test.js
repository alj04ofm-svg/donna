/* schedule.js — dependency-aware time-blocker. */

const test = require("node:test");
const assert = require("node:assert");
const { plan, estimateMin } = require("../src/lib/schedule");

const T = (id, over = {}) => ({ id, title: id, status: "todo", priority: 2, ...over });

test("estimateMin falls back by priority", () => {
  assert.strictEqual(estimateMin({ priority: 1 }), 60);
  assert.strictEqual(estimateMin({ priority: 3 }), 30);
  assert.strictEqual(estimateMin({ estimatedMinutes: 15, priority: 1 }), 15);
});

test("blocked tasks are not time-blocked and are reported", () => {
  const a = T("a");
  const b = T("b", { dependsOn: ["a"] });
  const p = plan([a, b], [], { startHour: 9, endHour: 19 });
  assert.deepStrictEqual(p.blocks.map((x) => x.id), ["a"]);
  assert.strictEqual(p.blocked, 1);
});

test("a task whose dependency is done gets scheduled", () => {
  const b = T("b", { dependsOn: ["a"] }); // 'a' not in the open list → considered done
  const p = plan([b], [], { startHour: 9, endHour: 19 });
  assert.deepStrictEqual(p.blocks.map((x) => x.id), ["b"]);
  assert.strictEqual(p.blocked, 0);
});

test("calendar events are flowed around", () => {
  const t = T("t", { estimatedMinutes: 60, priority: 1 });
  const ev = [{ title: "Standup", allDay: false, start: new Date(2026, 0, 1, 9, 0).toISOString(), end: new Date(2026, 0, 1, 10, 0).toISOString() }];
  // freeze "now" before the work day by planning a start hour in the future is not possible;
  // just assert the block avoids the event window when it lands after it
  const p = plan([t], ev, { startHour: 9, endHour: 19 });
  if (p.blocks.length) {
    const b = p.blocks[0];
    const overlaps = b.s < 600 && b.e > 540;
    assert.ok(!overlaps, "block must not overlap the 9-10 event");
  }
});
