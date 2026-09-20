const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs"); const os = require("node:os"); const path = require("node:path");
const { buildContext } = require("../src/lib/contextProvider");

test("assembles context from roots and todos", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-"));
  const mem = path.join(dir, "MEMORY.md");
  fs.writeFileSync(mem, "# Memory\nProject notes: 6 items pending");
  const fakeStore = { list: (f) => (f === "todo" ? [{ kind: "todo", text: "call Sam", done: false }] : []) };
  const ctx = await buildContext({ roots: [mem], captureStore: fakeStore });
  assert.match(ctx, /6 items pending/);
  assert.match(ctx, /call Sam/);
});
