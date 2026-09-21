"use strict";

/* Tables — lightweight local grids (an Airtable/Sheets stand-in). Stored as
   JSON alongside the rest of the user's data; import from CSV/TSV/XLSX/XLS
   (Airtable, Google Sheets and Excel all export to these). */

const fs = require("node:fs");
const path = require("node:path");
const { dataPath } = require("./paths");

const FILE = dataPath("tables.json");
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); } catch {} };
const now = () => new Date().toISOString();
const slug = (s) => String(s || "col").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "col";

function list() {
  return read().map((t) => ({ id: t.id, name: t.name, rows: (t.rows || []).length, cols: (t.columns || []).length, updatedAt: t.updatedAt }));
}
function get(id) { return read().find((t) => t.id === id) || null; }
function create(name, columns, rows) {
  const a = read();
  const t = { id: `t_${Date.now()}`, name: (name || "Untitled table").slice(0, 120), columns: columns || [], rows: rows || [], createdAt: now(), updatedAt: now() };
  a.push(t); write(a); return t.id;
}
function remove(id) { write(read().filter((t) => t.id !== id)); }
function rename(id, name) {
  const a = read(); const t = a.find((x) => x.id === id);
  if (t) { t.name = String(name || t.name).slice(0, 120); t.updatedAt = now(); write(a); }
  return !!t;
}
function setCell(id, rowIndex, key, value) {
  const a = read(); const t = a.find((x) => x.id === id);
  if (t && t.rows[rowIndex]) { t.rows[rowIndex][key] = value; t.updatedAt = now(); write(a); }
  return !!t;
}
function addRow(id, row) {
  const a = read(); const t = a.find((x) => x.id === id);
  if (t) { t.rows.push(row || {}); t.updatedAt = now(); write(a); return t.rows.length - 1; }
  return -1;
}
function removeRow(id, rowIndex) {
  const a = read(); const t = a.find((x) => x.id === id);
  if (t) { t.rows.splice(rowIndex, 1); t.updatedAt = now(); write(a); }
  return !!t;
}
function addColumn(id, name) {
  const a = read(); const t = a.find((x) => x.id === id);
  if (!t) return null;
  let key = slug(name), base = key, i = 2;
  while (t.columns.some((c) => c.key === key)) key = `${base}_${i++}`;
  t.columns.push({ key, name: (name || "Column").slice(0, 60), type: "text" });
  t.updatedAt = now(); write(a); return key;
}
/* Build a table from an array-of-arrays: first row = headers. */
function importRows(name, matrix) {
  const rowsIn = (matrix || []).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
  if (!rowsIn.length) return null;
  const headers = rowsIn[0].map((h, i) => ({ key: slug(h || `col${i + 1}`), name: String(h || `Column ${i + 1}`).slice(0, 60), type: "text" }));
  // de-dupe keys
  const seen = new Set();
  headers.forEach((h) => { let k = h.key, n = 2; while (seen.has(k)) k = `${h.key}_${n++}`; h.key = k; seen.add(k); });
  const rows = rowsIn.slice(1).map((r) => { const o = {}; headers.forEach((h, i) => { o[h.key] = r[i] ?? ""; }); return o; });
  return create(name, headers, rows);
}

module.exports = { list, get, create, remove, rename, setCell, addRow, removeRow, addColumn, importRows };
