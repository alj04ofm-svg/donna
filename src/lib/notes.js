const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Notes — a lightweight knowledge store for anything worth keeping that isn't a
   task: decisions, references, credentials-to-remember, playbook snippets. Plain
   text with a title; newest first. Separate from Capture (fast inbox) — this is
   the durable library. */

const FILE = dataPath("notes.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); } catch {} };

function list() { return read().slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")); }

/* Collision-proof note id (rapid adds + daily + duplicate). */
function newId(existing) {
  const ids = new Set((existing || []).map((n) => n.id));
  let id;
  do { id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; } while (ids.has(id));
  return id;
}

function normTags(list, max = 12) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const t = String(raw || "").replace(/^#/, "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function add(title, body) {
  const a = read();
  const now = new Date().toISOString();
  const n = { id: newId(a), title: (title || "Untitled").slice(0, 140), body: (body || "").slice(0, 200000), tags: [], createdAt: now, updatedAt: now };
  a.push(n); write(a);
  try { require("./activity").log("note_added", n.title, { ref: { type: "note", id: n.id } }); } catch {}
  return n.id;
}
function update(id, patch) {
  const a = read(); const n = a.find((x) => x.id === id);
  if (n) {
    if (patch && "tags" in patch) patch = { ...patch, tags: normTags(patch.tags) };
    Object.assign(n, patch, { updatedAt: new Date().toISOString() });
    write(a);
  }
  return !!n;
}
function remove(id) { write(read().filter((x) => x.id !== id)); }

function setTags(id, tags) { return update(id, { tags: normTags(tags) }); }

/* label → count across all notes, for the tag rail */
function allTags() {
  const counts = {};
  for (const n of read()) for (const t of (Array.isArray(n.tags) ? n.tags : [])) counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}

function duplicate(id) {
  const a = read(); const n = a.find((x) => x.id === id);
  if (!n) return null;
  const now = new Date().toISOString();
  const copy = { ...n, id: newId(a), title: `${n.title || "Untitled"} (copy)`.slice(0, 140), pinned: false, createdAt: now, updatedAt: now, tags: Array.isArray(n.tags) ? n.tags.slice() : [] };
  a.push(copy); write(a);
  return copy.id;
}

/* Daily Note — auto-created per day if it doesn't exist. Format:
   "2026-07-10 — Daily Note" with a small template body. */
function ensureDaily(date = new Date()) {
  const iso = date.toISOString().slice(0, 10);
  const title = `${iso} — Daily Note`;
  const existing = read().find((n) => n.title === title);
  if (existing) return existing;
  const body = [
    `## ${date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`,
    ``,
    `### Win`,
    `- `,
    ``,
    `### Lead action`,
    `- `,
    ``,
    `### Notes`,
    ``,
    `### Tomorrow`,
    `- `,
  ].join("\n");
  const id = add(title, body);
  return read().find((n) => n.id === id) || { id, title, body };
}

function recent(n = 14) {
  return read().slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, n);
}

module.exports = { list, add, update, remove, ensureDaily, recent, newId, setTags, allTags, duplicate, normTags };
