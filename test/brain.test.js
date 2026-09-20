const { test } = require("node:test");
const assert = require("node:assert");
const os = require("node:os"); const path = require("node:path");
const { createBrain } = require("../src/lib/brain");
const { createCaptureStore } = require("../src/lib/captureStore");

test("capture intent stores without model; questions route to a client", async () => {
  const store = createCaptureStore(path.join(os.tmpdir(), `b-${Date.now()}.json`));
  const calls = [];
  const clients = {
    m3: async () => { calls.push("m3"); return "m3 answer"; },
    opus: async () => { calls.push("opus"); return "opus answer"; },
    fable: async () => { calls.push("fable"); return "fable answer"; },
  };
  const brain = createBrain({ config: { contextRoots: [] }, captureStore: store, clients });
  const cap = await brain.ask("todo: call George", {});
  assert.match(cap.answer, /Got it|captured|added/i);
  assert.equal(store.list("todo").length, 1);
  assert.equal(calls.length, 0);
  const q = await brain.ask("what's the status", {});
  assert.equal(q.tier, "m3");
  assert.equal(q.answer, "m3 answer");
});
