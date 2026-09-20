const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs"); const os = require("node:os"); const path = require("node:path");
const { buildContext } = require("../src/lib/contextProvider");
test("assembles context from roots, todos, and command", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-"));
  const mem = path.join(dir, "MEMORY.md"); fs.writeFileSync(mem, "# Memory\nWC reels: 6 clips pending");
  const fakeStore = { list: (f) => (f === "todo" ? [{ kind: "todo", text: "call George", done: false }] : []) };
  const ctx = await buildContext({ roots: [mem], captureStore: fakeStore, runCmd: () => "pane pX working" });
  assert.match(ctx, /WC reels: 6 clips pending/);
  assert.match(ctx, /call George/);
  assert.match(ctx, /pane pX working/);
});
