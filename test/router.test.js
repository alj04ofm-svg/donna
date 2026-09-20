const { test } = require("node:test");
const assert = require("node:assert");
const { route } = require("../src/lib/router");
test("routes by prefix and heuristics", () => {
  assert.deepEqual(route("quick: what time is it"), { tier: "m3", text: "what time is it" });
  assert.deepEqual(route("think: analyze this"), { tier: "opus", text: "analyze this" });
  assert.deepEqual(route("best: write me a launch plan"), { tier: "fable", text: "write me a launch plan" });
  assert.equal(route("what's the status of the WC reels").tier, "m3");       // default M3
  assert.equal(route("summarize my open todos and today's posts").tier, "m3"); // everyday → M3
  assert.equal(route("write a scroll-stop hook for a gossip reel").tier, "fable"); // creative
  assert.equal(route("should I rebrand the Leila account and why").tier, "opus"); // important
});
