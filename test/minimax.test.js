const { test } = require("node:test");
const assert = require("node:assert");
const { stripThink } = require("../src/lib/models/minimax");
test("strips think blocks", () => {
  assert.equal(stripThink("<think>reasoning</think>Hello"), "Hello");
  assert.equal(stripThink("Plain"), "Plain");
});
