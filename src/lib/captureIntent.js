function parseCapture(text) {
  const t = text.trim();
  let m = t.match(/^(todo|task)\s*[:\-]\s*(.+)/i); if (m) return { kind: "todo", text: m[2].trim() };
  m = t.match(/^note\s*[:\-]\s*(.+)/i); if (m) return { kind: "note", text: m[1].trim() };
  m = t.match(/^remind me to\s+(.+)/i); if (m) return { kind: "todo", text: m[1].trim() };
  return null;
}
module.exports = { parseCapture };
