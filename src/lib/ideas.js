const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Content-idea bank — a fast dump for reel hooks / concepts before they're ready
   to become tasks. Tag by niche, promote to a task when it's time to make it,
   mark used once shipped. The top-of-funnel above Production. */

const FILE = dataPath("ideas.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); } catch {} };

function list() { return read().slice().sort((a, b) => (a.used ? 1 : 0) - (b.used ? 1 : 0) || String(b.createdAt).localeCompare(String(a.createdAt))); }
function add(text, niche) { const a = read(); a.push({ id: `i_${Date.now()}`, text: String(text || "").slice(0, 400), niche: niche || "", used: false, createdAt: new Date().toISOString() }); write(a); }
function update(id, patch) { const a = read(); const x = a.find((y) => y.id === id); if (x) { Object.assign(x, patch); write(a); } return !!x; }
function remove(id) { write(read().filter((x) => x.id !== id)); }

module.exports = { list, add, update, remove };
