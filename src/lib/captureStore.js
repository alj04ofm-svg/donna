const fs = require("node:fs");
function createCaptureStore(filePath) {
  const read = () => { try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return []; } };
  const write = (items) => { fs.mkdirSync(require("node:path").dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, JSON.stringify(items, null, 2)); };
  return {
    add(kind, text) {
      const items = read();
      const item = { id: `${Date.now()}-${items.length}`, kind, text, done: false, created_at: new Date().toISOString() };
      items.push(item); write(items); return item;
    },
    list(filter) { const items = read(); return filter ? items.filter((i) => i.kind === filter) : items; },
    complete(id) { const items = read(); const it = items.find((i) => i.id === id); if (it) it.done = true; write(items); return it; },
  };
}
module.exports = { createCaptureStore };
