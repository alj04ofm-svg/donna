const { test } = require("node:test");
const assert = require("node:assert");
const { parseCapture } = require("../src/lib/captureIntent");
test("detects note/todo/reminder, ignores questions", () => {
  assert.deepEqual(parseCapture("todo: source WC clips"), { kind: "todo", text: "source WC clips" });
  assert.deepEqual(parseCapture("note: gym reel idea"), { kind: "note", text: "gym reel idea" });
  assert.deepEqual(parseCapture("remind me to pay the invoice"), { kind: "todo", text: "pay the invoice" });
  assert.equal(parseCapture("what's on my plate?"), null);
});
