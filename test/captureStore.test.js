const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createCaptureStore } = require("../src/lib/captureStore");

test("adds and lists items, completes a todo", () => {
  const f = path.join(os.tmpdir(), `cap-${Date.now()}.json`);
  const s = createCaptureStore(f);
  const a = s.add("todo", "source WC clips");
  s.add("note", "idea: gym reel");
  assert.equal(s.list().length, 2);
  assert.equal(s.list("todo").length, 1);
  s.complete(a.id);
  assert.equal(s.list("todo")[0].done, true);
  fs.unlinkSync(f);
});
