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
function add(title, body) {
  const a = read();
  const now = new Date().toISOString();
  const n = { id: `n_${Date.now()}`, title: (title || "Untitled").slice(0, 140), body: (body || "").slice(0, 20000), createdAt: now, updatedAt: now };
  a.push(n); write(a);
  try { require("./activity").log("note_added", n.title, { ref: { type: "note", id: n.id } }); } catch {}
  return n.id;
}
function update(id, patch) {
  const a = read(); const n = a.find((x) => x.id === id);
  if (n) { Object.assign(n, patch, { updatedAt: new Date().toISOString() }); write(a); }
  return !!n;
}
function remove(id) { write(read().filter((x) => x.id !== id)); }

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
  return add(title, body);
}

function recent(n = 14) {
  return read().slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, n);
}

module.exports = { list, add, update, remove, ensureDaily, recent };
