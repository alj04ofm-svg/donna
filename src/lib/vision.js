const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Vision — the long horizon. Not a score sheet (that was pointless): where Alex
   wants to be at 1mo / 3mo / 1yr / 5yr across each life area, each with the
   concrete steps to get there. Set the far star, cascade it back to this month.
   Donna can break a vision into steps (the brain) so it's a plan, not a wish. */

const FILE = dataPath("vision.json");
const HORIZONS = ["1mo", "3mo", "1yr", "5yr"];
const AREAS = ["work", "money", "health", "relationships"];

const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
const write = (d) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d)); } catch {} };
const key = (h, a) => `${h}|${a}`;
const cell = (d, h, a) => (d[key(h, a)] = d[key(h, a)] || { vision: "", steps: [] });

function get() { return read(); }
function setVision(h, a, text) { const d = read(); cell(d, h, a).vision = String(text || "").slice(0, 400); write(d); }
function addStep(h, a, text) { const d = read(); cell(d, h, a).steps.push({ id: `s_${Date.now()}_${Math.floor(Math.random() * 1e4)}`, text: String(text || "").slice(0, 160), done: false }); write(d); }
function addSteps(h, a, texts) { const d = read(); const c = cell(d, h, a); (texts || []).slice(0, 8).forEach((t, i) => c.steps.push({ id: `s_${Date.now()}_${i}`, text: String(t || "").slice(0, 160), done: false })); write(d); }
function toggleStep(h, a, id) { const d = read(); const s = (d[key(h, a)] && d[key(h, a)].steps || []).find((x) => x.id === id); if (s) { s.done = !s.done; write(d); } }
function removeStep(h, a, id) { const d = read(); if (d[key(h, a)]) d[key(h, a)].steps = (d[key(h, a)].steps || []).filter((x) => x.id !== id); write(d); }

module.exports = { get, setVision, addStep, addSteps, toggleStep, removeStep, HORIZONS, AREAS };
