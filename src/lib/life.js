const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* The life wheel (Designing Your Life) — score Work/Money/Health/Relationships
   before you plan anything, because you can't fix what you won't name. Scored
   by hand (1-10), not derived, so it stays an honest self-read rather than a
   number the app flatters you with. History kept so a domain's trend shows,
   not just its latest score. */

const FILE = dataPath("life.json");
const DOMAINS = ["work", "money", "health", "relationships"];

const DEFAULT = {
  work: { score: 5, note: "", history: [] },
  money: { score: 5, note: "", history: [] },
  health: { score: 5, note: "", history: [] },
  relationships: { score: 5, note: "", history: [] },
};

const read = () => { try { return { ...DEFAULT, ...JSON.parse(fs.readFileSync(FILE, "utf8")) }; } catch { return JSON.parse(JSON.stringify(DEFAULT)); } };
const write = (d) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d)); } catch {} };

function get() {
  const d = read();
  return DOMAINS.map((domain) => ({ domain, score: d[domain].score, note: d[domain].note, updatedAt: d[domain].history.length ? d[domain].history[d[domain].history.length - 1].at : null, history: d[domain].history }));
}
function setScore(domain, score, note) {
  if (!DOMAINS.includes(domain)) return false;
  const d = read();
  const s = Math.max(1, Math.min(10, Number(score) || 0));
  d[domain].score = s;
  d[domain].note = note || "";
  d[domain].history.push({ at: new Date().toISOString(), score: s });
  if (d[domain].history.length > 52) d[domain].history = d[domain].history.slice(-52); // ~a year of weekly re-scores
  write(d);
  return true;
}
function lowest() {
  const rows = get();
  return rows.reduce((a, b) => (b.score < a.score ? b : a), rows[0]);
}

module.exports = { DOMAINS, get, setScore, lowest };
