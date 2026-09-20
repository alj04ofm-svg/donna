const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Reminders — time-based pokes. Donna's main process polls due() and fires a
   native notification, so you get tapped at the right moment without holding
   it in his head. */

const FILE = dataPath("reminders.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); } catch {} };

function add(text, at) { const a = read(); a.push({ id: `r_${Date.now()}`, text: String(text || "").slice(0, 200), at, fired: false }); write(a); }
function list() { return read().filter((r) => !r.fired).sort((a, b) => String(a.at).localeCompare(String(b.at))); }
function due() { const now = new Date().toISOString(); return read().filter((r) => !r.fired && r.at && r.at <= now); }
function markFired(id) { const a = read(); const r = a.find((x) => x.id === id); if (r) r.fired = true; write(a); }
function done(id) { write(read().filter((x) => x.id !== id)); }

module.exports = { add, list, due, markFired, done };
