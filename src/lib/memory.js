const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Donna's memory — the "she knows me" layer. Structured facts about Alex,
   mined ambiently from conversation (Dot's green-flash pattern) and editable
   by hand, because trust requires inspectability: he can see, correct, and
   delete anything she believes. Facts feed the morning brief and replies.
   Rule from Dot's postmortem: never fabricate specifics — a fact is stored
   verbatim with its source, and low confidence means Donna stays silent. */

const FILE = dataPath("memory.json");
const KINDS = ["person", "preference", "date", "project", "health", "fact"];

const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a, null, 2)); } catch {} };

function list() { return read().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); }

function add(fact, kind, source) {
  const text = String(fact || "").trim().slice(0, 240);
  if (!text) return null;
  const a = read();
  // near-duplicate guard: same normalized text = update timestamp, don't stack
  const norm = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const dupe = a.find((f) => f.fact.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === norm);
  if (dupe) { dupe.seenAt = new Date().toISOString(); write(a); return dupe.id; }
  const f = {
    id: `m_${Date.now()}_${a.length}`,
    fact: text,
    kind: KINDS.includes(kind) ? kind : "fact",
    source: (source || "chat").slice(0, 40),
    createdAt: new Date().toISOString(),
    seenAt: new Date().toISOString(),
  };
  a.push(f); write(a);
  return f.id;
}
function update(id, patch) { const a = read(); const f = a.find((x) => x.id === id); if (f) { if (patch.fact) f.fact = String(patch.fact).slice(0, 240); if (patch.kind && KINDS.includes(patch.kind)) f.kind = patch.kind; write(a); } return !!f; }
function remove(id) { write(read().filter((x) => x.id !== id)); return true; }

/* a compact block for prompts — most recent per kind first, hard cap */
function promptBlock(max = 14) {
  const a = list().slice(0, max);
  if (!a.length) return "";
  return "KNOWN ABOUT ALEX (his own words, stored facts — use naturally, never invent more):\n" +
    a.map((f) => `- [${f.kind}] ${f.fact}`).join("\n");
}

module.exports = { list, add, update, remove, promptBlock, KINDS };
