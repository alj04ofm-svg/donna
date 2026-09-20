/* backlinks.js — Roam-style [[name]] cross-references. A small index
   that scans tasks, goals, notes, ideas, decisions for [[name]] mentions
   and surfaces "what links to me" for any entity.

   The `[[X]]` syntax works case-insensitive. If X matches a task title,
   goal objective, note title, idea text, or decision title, it's a real
   link. If it doesn't match, it's left as literal text.

   The renderer calls resolveBacklinks(text) to convert [[X]] to
   clickable links, and backlinksFor(kind, id) to find everything
   that mentions this entity. */

const tasks = require("./tasks");
const goals = require("./goals");
const notes = require("./notes");
const ideas = require("./ideas");
const decisions = require("./decisions");

const RX = /\[\[([^\]\n]{1,80})\]\]/g;

function entityIndex() {
  const idx = new Map();
  const add = (kind, id, label) => { if (label) idx.set(String(label).toLowerCase().trim(), { kind, id, label }); };
  try { for (const t of tasks.summary().open) add("task", t.id, t.title); } catch {}
  try { for (const g of goals.list()) add("goal", g.id, g.objective || g.title); } catch {}
  try { for (const n of notes.list()) add("note", n.id, n.title); } catch {}
  try { for (const i of ideas.list()) add("idea", i.id, i.text); } catch {}
  try { for (const d of decisions.list()) add("decision", d.id, d.title); } catch {}
  return idx;
}

/* Convert [[X]] in text to <a class="backlink" data-kind="task" data-id="X">X</a>.
   Unknown [[X]] stays literal. */
function resolveInText(text) {
  if (!text || text.indexOf("[[") < 0) return text;
  const idx = entityIndex();
  return text.replace(RX, (m, raw) => {
    const k = String(raw).toLowerCase().trim();
    const hit = idx.get(k);
    if (!hit) return m; // unknown — keep literal
    return `<a class="backlink" data-bk-kind="${hit.kind}" data-bk-id="${hit.id}">${raw}</a>`;
  });
}

/* Find all entities that mention [[X]] where X matches this entity. */
function backlinksFor(kind, id) {
  const target = { task: null, goal: null, note: null, idea: null, decision: null };
  /* figure out the display label for this entity */
  let label = null;
  try {
    if (kind === "task") label = tasks.summary().open.find((t) => t.id === id)?.title;
    if (kind === "goal") label = goals.list().find((g) => g.id === id)?.objective || goals.list().find((g) => g.id === id)?.title;
    if (kind === "note") label = notes.list().find((n) => n.id === id)?.title;
    if (kind === "idea") label = ideas.list().find((i) => i.id === id)?.text;
    if (kind === "decision") label = decisions.list().find((d) => d.id === id)?.title;
  } catch {}
  if (!label) return [];
  const needle = `[[${label.toLowerCase().trim()}]]`;
  const results = [];
  try {
    for (const t of tasks.summary().open) {
      if (t.id === id) continue;
      if (String(t.title || "").toLowerCase().includes(needle)) results.push({ kind: "task", id: t.id, label: t.title, context: "title" });
      if (String(t.detail || "").toLowerCase().includes(needle)) results.push({ kind: "task", id: t.id, label: t.title, context: "detail" });
    }
  } catch {}
  try {
    for (const g of goals.list()) {
      if (g.id === id) continue;
      const hay = `${g.objective || g.title || ""} ${g.why || ""} ${g.oneThing || ""}`.toLowerCase();
      if (hay.includes(needle)) results.push({ kind: "goal", id: g.id, label: g.objective || g.title, context: "goal" });
    }
  } catch {}
  try {
    for (const n of notes.list()) {
      if (n.id === id) continue;
      const hay = `${n.title || ""} ${n.body || ""}`.toLowerCase();
      if (hay.includes(needle)) results.push({ kind: "note", id: n.id, label: n.title, context: "note" });
    }
  } catch {}
  try {
    for (const i of ideas.list()) {
      if (i.id === id) continue;
      if (String(i.text || "").toLowerCase().includes(needle)) results.push({ kind: "idea", id: i.id, label: i.text, context: "idea" });
    }
  } catch {}
  try {
    for (const d of decisions.list()) {
      if (d.id === id) continue;
      const hay = `${d.title || ""} ${d.why || ""} ${d.alternatives || ""}`.toLowerCase();
      if (hay.includes(needle)) results.push({ kind: "decision", id: d.id, label: d.title, context: "decision" });
    }
  } catch {}
  return results;
}

module.exports = { resolveInText, backlinksFor };
