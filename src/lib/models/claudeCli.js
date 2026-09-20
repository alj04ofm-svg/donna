const { spawn } = require("node:child_process");
function askClaude(prompt, { model, system } = {}) {
  const full = system ? `${system}\n\n---\n\n${prompt}` : prompt;
  return new Promise((resolve, reject) => {
    const p = spawn("claude", ["-p", "--model", model], { env: process.env });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? resolve(out.trim()) : reject(new Error(err || `claude exited ${c}`))));
    p.stdin.write(full); p.stdin.end();
  });
}
module.exports = { askClaude };
