const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* categories.js — turns raw activity into meaning (ActivityWatch semantics):
   ordered rules matched against app|title|url, FIRST match wins (rules are
   ordered specific → general, which is deepest-match in practice). Every
   category carries a level −2..+2 (RescueTime): the daily Pulse is computed
   from time-weighted levels. Rules are data, so edits re-score ALL history —
   nothing is baked into stored events.
   User overrides live in data/categories.json (same shape, prepended). */

const FILE = dataPath("categories.json");

/* Default app-category rules, tuned for deep work vs the pull. Users can
   override these in the tracker settings. */
const DEFAULTS = [
  // ── deep work: the operation itself
  { cat: "Creative", level: 2, match: "higgsfield|veo|runway|capcut|final cut|davinci|premiere|after effects" },
  { cat: "Dev & AI", level: 2, match: "claude|cursor|terminal|iterm|warp|vscode|code|xcode" },
  { cat: "Work · Dashboards", level: 2, match: "localhost|dashboard|notion|airtable|linear|asana|trello|clickup" },
  { cat: "Code", level: 2, match: "code|xcode|electron|node|python|github" },
  // ── real work, lighter
  { cat: "Social · Publishing", level: 1, match: "instagram.com/create|later|buffer|metricool" },
  { cat: "Comms", level: 1, match: "gmail|mail|superhuman|content snare|contentsnare" },
  { cat: "Research · Niche", level: 1, match: "instagram.com/(reel|p)/|tiktok.com/@|swipe|instrack" },
  { cat: "Docs & Notes", level: 1, match: "notion|obsidian|notes|preview|pages|numbers|docs.google" },
  // ── the pull — MUST outrank the generic browser rule: content beats container,
  //    or "Instagram in Arc" scores as neutral Browsing
  { cat: "Chat", level: -1, match: "whatsapp|telegram|messages|discord|slack" },
  { cat: "Social feeds", level: -2, match: "instagram|tiktok|twitter|x\\.com|reddit|facebook|threads" },
  { cat: "Entertainment", level: -2, match: "youtube|netflix|spotify|twitch|prime video|steam" },
  // ── neutral fallbacks
  { cat: "Browsing", level: 0, match: "safari|chrome|arc|brave|firefox" },
  { cat: "Files & System", level: 0, match: "finder|system settings|activity monitor|disk" },
];

function rules() {
  let user = [];
  try { user = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
  return [...(Array.isArray(user) ? user : []), ...DEFAULTS]
    .map((r) => { try { return { ...r, re: new RegExp(r.match, "i") }; } catch { return null; } })
    .filter(Boolean);
}

function saveUserRules(list) {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(list, null, 2)); } catch {}
}

/* classify one event — matches app, then title, then url; first rule wins */
function classify(ev, compiled) {
  const rs = compiled || rules();
  const hay = `${ev.app || ""} ${ev.title || ""} ${ev.url || ""}`;
  for (const r of rs) if (r.re.test(hay)) return { cat: r.cat, level: r.level };
  return { cat: "Uncategorized", level: 0 };
}

/* hue per top-level category group — one palette everywhere (timeline, bars) */
const HUES = {
  Creative: 330, "Dev & AI": 250, "Work · Dashboards": 250, Code: 250,
  "Social · Publishing": 200, Comms: 200, "Research": 85, "Docs & Notes": 85,
  Browsing: 160, "Files & System": 160, Chat: 25, "Social feeds": 25, Entertainment: 25, Uncategorized: 0,
};
const hueOf = (cat) => HUES[cat] ?? 0;

module.exports = { rules, classify, saveUserRules, hueOf, DEFAULTS };
