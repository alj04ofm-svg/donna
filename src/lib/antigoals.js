/* antigoals.js — things you'll NEVER do. "No lipsync to old voice."
   Hard guardrails. Stored in data/antigoals.json. Powers the inverse
   of the goals page: instead of what you're working toward, what
   you're working against. Donna surfaces these in nudges when
   relevant. */

const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

const FILE = dataPath("antigoals.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a, null, 2)); } catch {} };
const uid = () => `ag_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

function list() { return read().sort((a, b) => String(b.at).localeCompare(String(a.at))); }
function add({ rule, why, expires }) {
  const a = read();
  a.push({ id: uid(), rule: String(rule || "").slice(0, 200), why: String(why || "").slice(0, 500),
    expires: expires || null, at: new Date().toISOString() });
  write(a);
  return a[a.length - 1];
}
function remove(id) { write(read().filter((x) => x.id !== id)); }

module.exports = { list, add, remove };
