const fs = require("node:fs");
const { execSync } = require("node:child_process");
function readTrimmed(p, n = 1500) {
  try {
    const st = fs.statSync(p);
    if (st.isDirectory()) return fs.readdirSync(p).slice(0, 40).join(", ");
    return fs.readFileSync(p, "utf8").slice(0, n);
  } catch { return null; }
}
async function buildContext({ roots = [], captureStore, runCmd }) {
  const cmd = runCmd || ((c) => { try { return execSync(c, { encoding: "utf8", timeout: 8000 }); } catch { return ""; } });
  const parts = [];
  for (const r of roots) { const body = readTrimmed(r); if (body) parts.push(`## ${r}\n${body}`); }
  if (captureStore) {
    const todos = captureStore.list("todo").filter((t) => !t.done).map((t) => `- ${t.text}`).join("\n");
    if (todos) parts.push(`## open todos\n${todos}`);
  }
  return parts.join("\n\n");
}
module.exports = { buildContext };
