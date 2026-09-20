/* decisions.js — the decision log. "What did I decide and why."
   Each decision has: title, why, alternatives, who knows, status.
   Stored in data/decisions.json. Powers a future Decisions page. */

const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

const FILE = dataPath("decisions.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a, null, 2)); } catch {} };
const uid = () => `d_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

function list() { return read().sort((a, b) => String(b.at).localeCompare(String(a.at))); }
function add({ title, why, alternatives, who, status = "active" }) {
  const a = read();
  a.push({ id: uid(), title: String(title || "").slice(0, 200), why: String(why || "").slice(0, 1000),
    alternatives: String(alternatives || "").slice(0, 500), who: String(who || "").slice(0, 200),
    status, at: new Date().toISOString() });
  write(a);
  return a[a.length - 1];
}
function update(id, patch) { const a = read(); const x = a.find((d) => d.id === id); if (x) { Object.assign(x, patch, { updatedAt: new Date().toISOString() }); write(a); } return !!x; }
function remove(id) { write(read().filter((x) => x.id !== id)); }

module.exports = { list, add, update, remove };
