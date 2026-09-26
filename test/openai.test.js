/* OpenAI-compatible client tests — including the OpenCode Zen/Go specifics
   (session header, base URL, model). Uses a mocked fetch; no network. */

const test = require("node:test");
const assert = require("node:assert");

process.env.OPENAI_BASE_URL = "https://opencode.ai/zen/go/v1";
process.env.OPENAI_API_KEY = "sk-test";
process.env.DONNA_MODEL = "deepseek-v4.1-flash";
delete process.env.OPENCODE_SESSION;

const { askOpenAI } = require("../src/lib/models/openai");

function mockFetch(handler) { global.fetch = handler; }
function resp(content) { return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) }; }

test("OpenCode host: sends x-opencode-session, correct URL + model + auth", async () => {
  process.env.OPENAI_BASE_URL = "https://opencode.ai/zen/go/v1";
  process.env.DONNA_MODEL = "deepseek-v4.1-flash";
  let seen = null;
  mockFetch(async (url, opts) => { seen = { url, headers: opts.headers, body: JSON.parse(opts.body) }; return resp("DONNA OK"); });
  const out = await askOpenAI("hi", { system: "sys" });
  assert.strictEqual(out, "DONNA OK");
  assert.strictEqual(seen.url, "https://opencode.ai/zen/go/v1/chat/completions");
  assert.strictEqual(seen.headers.Authorization, "Bearer sk-test");
  assert.ok(seen.headers["x-opencode-session"], "session header present");
  assert.strictEqual(seen.body.model, "deepseek-v4.1-flash");
  assert.strictEqual(seen.body.messages[0].role, "system");
});

test("non-OpenCode host: no session header", async () => {
  process.env.OPENAI_BASE_URL = "https://api.openai.com/v1";
  let seen = null;
  mockFetch(async (url, opts) => { seen = { headers: opts.headers }; return resp("ok"); });
  await askOpenAI("hi");
  assert.ok(!seen.headers["x-opencode-session"]);
  process.env.OPENAI_BASE_URL = "https://opencode.ai/zen/go/v1";
});

test("non-200 surfaces a readable error, never throws", async () => {
  mockFetch(async () => ({ ok: false, status: 429, statusText: "Too Many Requests", text: async () => JSON.stringify({ error: { message: "Go usage limit exceeded" } }) }));
  const out = await askOpenAI("hi");
  assert.match(out, /^\(AI 429/);
  assert.match(out, /Go usage limit exceeded/);
});

test("network failure returns a friendly message", async () => {
  mockFetch(async () => { throw new Error("boom"); });
  const out = await askOpenAI("hi");
  assert.match(out, /\(AI unavailable: boom\)/);
});
