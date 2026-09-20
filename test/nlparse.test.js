const test = require("node:test");
const assert = require("node:assert");
const { nlTokenize, nlDateFrom } = require("../src/lib/nlparse");

test("parses the full grammar in one line", () => {
  const { parsed } = nlTokenize("voice swap batch tomorrow 3pm p1 #worldcup @work =2h !friday");
  assert.equal(parsed.title, "voice swap batch");
  assert.equal(parsed.dueAt, nlDateFrom("tomorrow"));
  assert.equal(parsed.dueTime, "15:00");
  assert.equal(parsed.priority, 1);
  assert.equal(parsed.project_id, "worldcup");
  assert.equal(parsed.area, "work");
  assert.equal(parsed.estimatedMinutes, 120);
  assert.equal(parsed.deadline, nlDateFrom("friday"));
  assert.equal(parsed.deadlineHard, true);
});

test("buckets: tonight → evening with today's date, someday parks it", () => {
  const ev = nlTokenize("call mum tonight").parsed;
  assert.equal(ev.bucket, "evening");
  assert.equal(ev.dueAt, new Date().toISOString().slice(0, 10));
  const sd = nlTokenize("learn davinci resolve someday").parsed;
  assert.equal(sd.bucket, "someday");
  assert.equal(sd.dueAt, null);
});

test("waiting on + defaults", () => {
  const p = nlTokenize("elevenlabs invoice waiting on george").parsed;
  assert.equal(p.waitingOn, "george");
  assert.equal(p.title, "elevenlabs invoice");
  assert.equal(p.priority, 2);
});

test("quoted text is literal — the escape hatch", () => {
  const p = nlTokenize('research "best time to post friday" tomorrow').parsed;
  assert.equal(p.title, "research best time to post friday");
  assert.equal(p.dueAt, nlDateFrom("tomorrow"));
});

test("tokens carry spans for the highlighter", () => {
  const { tokens } = nlTokenize("ship reel tomorrow p1");
  const kinds = tokens.map((t) => t.kind);
  assert.ok(kinds.includes("date") && kinds.includes("priority"));
  for (const t of tokens) assert.ok(t.i1 > t.i0);
});

test("plain sentences pass through untouched", () => {
  const p = nlTokenize("fix the hero card spacing").parsed;
  assert.equal(p.title, "fix the hero card spacing");
  assert.equal(p.dueAt, null);
  assert.equal(p.bucket, null);
});
