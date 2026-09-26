/* Integration tests for tasks-ext.js — tags, dependencies, bulk edits,
   duplicate, templates and saved views. Runs against a throwaway data dir so
   the real store is never touched. */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.DONNA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "donna-tasks-ext-"));

const test = require("node:test");
const assert = require("node:assert");
const ext = require("../src/lib/tasks-ext");
const tasks = require("../src/lib/tasks");
const { nlTokenize } = require("../src/lib/nlparse");

const openTitles = () => tasks.summary().open.map((t) => t.title);

test("tags: add, dedupe, index, remove", () => {
  const id = tasks.add("Write the launch post");
  ext.setTags(id, ["Launch", "launch", "  marketing  ", "launch"]);
  let t = tasks.summary().open.find((x) => x.id === id);
  assert.deepStrictEqual(t.tags, ["launch", "marketing"], "trimmed, lower-cased, deduped");

  ext.addTag(id, "urgent");
  t = tasks.summary().open.find((x) => x.id === id);
  assert.deepStrictEqual(t.tags, ["launch", "marketing", "urgent"]);

  const idx = ext.tagIndex();
  assert.ok(idx.find((x) => x.tag === "launch" && x.count === 1));
  assert.ok(idx.find((x) => x.tag === "urgent" && x.count === 1));

  ext.removeTag(id, "marketing");
  t = tasks.summary().open.find((x) => x.id === id);
  assert.deepStrictEqual(t.tags, ["launch", "urgent"]);
});

test("dependencies: link, refuse cycles and self-links", () => {
  const a = tasks.add("Deploy staging");
  const b = tasks.add("Load test staging");
  const c = tasks.add("Announce release");

  assert.strictEqual(ext.setDeps(b, [a]).ok, true);
  assert.strictEqual(ext.setDeps(c, [b]).ok, true);

  // self-link is dropped (never an error)
  const self = ext.setDeps(a, [a]);
  assert.strictEqual(self.ok, true);
  assert.deepStrictEqual(self.dependsOn, []);

  // a → c → b → a would be a loop
  const cyc = ext.setDeps(a, [c]);
  assert.strictEqual(cyc.ok, false);

  const refs = ext.allRefs();
  assert.ok(refs.find((r) => r.id === a && r.title === "Deploy staging"));
});

test("bulkUpdate: patch many tasks at once", () => {
  const x = tasks.add("Old task one");
  const y = tasks.add("Old task two");
  const r = ext.bulkUpdate([x, y], { priority: 1, addTags: ["sprint-1"] });
  assert.strictEqual(r.count, 2);
  const open = tasks.summary().open;
  for (const id of [x, y]) {
    const t = open.find((o) => o.id === id);
    assert.strictEqual(t.priority, 1);
    assert.deepStrictEqual(t.tags, ["sprint-1"]);
  }
  ext.bulkUpdate([x, y], { status: "done" });
  const after = tasks.summary();
  assert.ok(after.done.find((o) => o.id === x));
});

test("deleteMany: removes tasks and cleans dangling deps", () => {
  const base = tasks.add("Base dependency");
  const child = tasks.add("Child");
  ext.setDeps(child, [base]);
  ext.deleteMany([base]);
  const c = tasks.summary().open.find((t) => t.id === child);
  assert.deepStrictEqual(c.dependsOn, []);
});

test("duplicate: copies fields, resets progress", () => {
  const id = tasks.add("Ship the newsletter");
  ext.setTags(id, ["content"]);
  ext.setDeps(id, []);
  const before = tasks.summary().open.length;
  const nid = ext.duplicate(id);
  assert.ok(nid && nid !== id);
  const open = tasks.summary().open;
  assert.strictEqual(open.length, before + 1);
  const copy = open.find((t) => t.id === nid);
  assert.strictEqual(copy.title, "Ship the newsletter");
  assert.deepStrictEqual(copy.tags, ["content"]);
  assert.strictEqual(copy.status, "todo");
});

test("templates: save from task, list, instantiate", () => {
  const id = tasks.add("Weekly review ritual");
  ext.setTags(id, ["ritual"]);
  const saved = ext.templateSaveFromTask(id, "Weekly review");
  assert.strictEqual(saved.ok, true);
  const list = ext.templatesList();
  assert.ok(list.find((t) => t.name === "Weekly review"));

  const inst = ext.templateInstantiate("Weekly review");
  assert.strictEqual(inst.ok, true);
  const made = tasks.summary().open.find((t) => t.id === inst.id);
  assert.strictEqual(made.title, "Weekly review ritual");
  assert.deepStrictEqual(made.tags, ["ritual"]);

  assert.strictEqual(ext.templateRemove("Weekly review").ok, true);
  assert.strictEqual(ext.templatesList().length, 0);
});

test("saved views: save, list, remove", () => {
  ext.viewSave("Due soon", { sort: "due", due: "week" });
  ext.viewSave("P1 work", { priority: "1", project: "work" });
  let views = ext.viewsList();
  assert.strictEqual(views.length, 2);
  assert.strictEqual(views.find((v) => v.name === "Due soon").payload.due, "week");
  ext.viewRemove(views.find((v) => v.name === "P1 work").id);
  views = ext.viewsList();
  assert.strictEqual(views.length, 1);
  assert.strictEqual(views[0].name, "Due soon");
});

test("grammar: +tag tokens parse into tags and leave the title alone", () => {
  const { parsed } = nlTokenize('email sam friday +followup +urgent');
  assert.deepStrictEqual(parsed.tags, ["followup", "urgent"]);
  assert.strictEqual(parsed.title, "email sam");
});

test("recurrence spawns the next instance when status flips to done", () => {
  const id = tasks.add("Daily standup");
  tasks.setField(id, "recurrence", { freq: "daily" });
  tasks.setStatus(id, "done");
  const next = tasks.summary().open.find((t) => t.title === "Daily standup" && t.id !== id);
  assert.ok(next, "drag-to-done regenerates a recurring task");
});

test("bulk complete also regenerates recurring tasks", () => {
  const id = tasks.add("Weekly report");
  tasks.setField(id, "recurrence", { freq: "weekly" });
  ext.bulkUpdate([id], { status: "done" });
  const next = tasks.summary().open.find((t) => t.title === "Weekly report" && t.id !== id);
  assert.ok(next, "bulk complete regenerates a recurring task");
});
