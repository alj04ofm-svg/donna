/* aliases.js — user-saved command shortcuts. "wc" → "filter tasks to
   #worldcup", "wk" → "open Week plan view", etc. Persisted in
   data/aliases.json. The command palette merges these into its
   buildActions() list. */

const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

const FILE = dataPath("aliases.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
const write = (d) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch {} };

function list() { return read(); }
function add(key, value) { const d = read(); d[String(key).toLowerCase().trim().slice(0, 30)] = String(value).slice(0, 200); write(d); }
function remove(key) { const d = read(); delete d[String(key).toLowerCase().trim()]; write(d); }
function resolve(query) {
  const d = read();
  const k = String(query).toLowerCase().trim().split(/\s+/)[0];
  if (d[k]) return d[k];
  /* try without the command word — "do wc" should also match "wc" */
  const stripped = String(query).replace(/^(do|run|go|tell|please)\s+/i, "").trim();
  if (stripped) {
    const k2 = stripped.toLowerCase().split(/\s+/)[0];
    if (d[k2]) return d[stripped.slice(k2.length + 1).trim() ? stripped : d[k2]];
  }
  return null;
}

module.exports = { list, add, remove, resolve };
