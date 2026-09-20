/* sleep.js — last-night sleep stat. Manual entry (auto-detect requires
   Health permissions that I don't want to ask for). Stored in
   data/sleep.json, surfaced on Today as a chip. */

const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

const FILE = dataPath("sleep.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
const write = (d) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d, null, 2)); } catch {} };

function get() {
  const d = read();
  const today = new Date().toISOString().slice(0, 10);
  return d[today] || null;
}
function set({ hours, quality, woke }) {
  const d = read();
  const today = new Date().toISOString().slice(0, 10);
  d[today] = { date: today, hours: Number(hours) || 0, quality: quality || null,
    woke: !!woke, at: new Date().toISOString() };
  write(d);
  return d[today];
}
function recent(n = 7) {
  const d = read();
  return Object.values(d).sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
}
function average() {
  const r = recent(7);
  if (!r.length) return null;
  return r.reduce((s, x) => s + (x.hours || 0), 0) / r.length;
}

module.exports = { get, set, recent, average };
