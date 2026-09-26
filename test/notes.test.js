/* Tests for the Notes knowledge-desk backend: tags, tag index, duplicate,
   collision-proof ids and the daily note. Runs in a throwaway data dir. */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.DONNA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "donna-notes-"));

const test = require("node:test");
const assert = require("node:assert");
const notes = require("../src/lib/notes");

test("tags: normalise on write and index across notes", () => {
  const id = notes.add("Playbook", "<p>hello</p>");
  notes.setTags(id, ["Ops", "ops", "  hiring ", "#growth"]);
  const n = notes.list().find((x) => x.id === id);
  assert.deepStrictEqual(n.tags, ["ops", "hiring", "growth"]);

  const idx = notes.allTags();
  assert.ok(idx.find((x) => x.tag === "ops" && x.count === 1));
});

test("duplicate: copies body and tags, resets pin, new id", () => {
  const id = notes.add("Decisions log", "<p>x</p>");
  notes.update(id, { pinned: true, tags: ["log"] });
  const before = notes.list().length;
  const nid = notes.duplicate(id);
  assert.ok(nid && nid !== id);
  assert.strictEqual(notes.list().length, before + 1);
  const copy = notes.list().find((x) => x.id === nid);
  assert.match(copy.title, /\(copy\)$/);
  assert.deepStrictEqual(copy.tags, ["log"]);
  assert.ok(!copy.pinned);
});

test("rapid adds never collide on id", () => {
  const idA = notes.add("A", "");
  const idB = notes.add("B", "");
  const idC = notes.add("C", "");
  assert.strictEqual(new Set([idA, idB, idC]).size, 3);
});

test("daily note is idempotent per day and returns the record", () => {
  const d = new Date("2026-03-04T09:00:00Z");
  const a = notes.ensureDaily(d);
  const b = notes.ensureDaily(d);
  assert.ok(a && a.id);
  assert.strictEqual(a.id, b.id);
  assert.match(a.title, /2026-03-04/);
});
