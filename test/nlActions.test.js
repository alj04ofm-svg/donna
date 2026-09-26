/* Plain-language task commands + overdue rollover (Motion-style). Runs in a
   throwaway data dir so the real store is untouched. */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.DONNA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "donna-nlact-"));

const test = require("node:test");
const assert = require("node:assert");
const tasks = require("../src/lib/tasks");
const nl = require("../src/lib/nlActions");

const find = (title) => tasks.summary().open.find((t) => t.title === title);
const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

test("complete <task> marks it done", () => {
  tasks.add("Invoice the client");
  const r = nl.run("complete the invoice");
  assert.ok(r && r.handled);
  assert.strictEqual(find("Invoice the client"), undefined);
  assert.ok(tasks.summary().done.find((t) => t.title === "Invoice the client"));
});

test("move <task> to tomorrow sets the due date", () => {
  tasks.add("Draft the proposal");
  const r = nl.run("move the proposal to tomorrow");
  assert.ok(r.handled);
  assert.strictEqual(find("Draft the proposal").dueAt.slice(0, 10), iso(1));
});

test("reschedule all p1 to next week", () => {
  const id = tasks.add("Ship the release");
  tasks.setPriority(id, 1);
  const r = nl.run("reschedule all p1 to next week");
  assert.ok(r.handled);
  assert.strictEqual(find("Ship the release").dueAt.slice(0, 10), iso(7));
});

test("roll overdue to today", () => {
  const id = tasks.add("Old thing");
  tasks.setDue(id, iso(-3));
  const r = nl.run("roll overdue to today");
  assert.ok(r.handled);
  assert.strictEqual(find("Old thing").dueAt.slice(0, 10), iso(0));
});

test("unknown text is not treated as a command", () => {
  assert.strictEqual(nl.run("what should I do first today?"), null);
  assert.strictEqual(nl.run("how do I complete a task?"), null);
});

test("rolloverOverdue ignores focus, waiting and someday", () => {
  const a = tasks.add("Overdue A"); tasks.setDue(a, iso(-2));
  const b = tasks.add("Overdue B"); tasks.setDue(b, iso(-1)); tasks.setWaiting(b, "Sam");
  const c = tasks.add("Overdue C"); tasks.setDue(c, iso(-5)); tasks.setField(c, "bucket", "someday");
  const n = tasks.rolloverOverdue();
  assert.strictEqual(n, 1, "only A rolls");
  assert.strictEqual(find("Overdue A").dueAt.slice(0, 10), iso(0));
  assert.strictEqual(find("Overdue B").dueAt.slice(0, 10), iso(-1), "waiting stays put");
  assert.strictEqual(find("Overdue C").dueAt.slice(0, 10), iso(-5), "someday stays put");
});
