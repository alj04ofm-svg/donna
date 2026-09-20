/* minimax.js — the M3 client Donna uses for almost everything.
   Hardened: never crash on missing key, exponential-backoff retry, surface
   graceful errors so the UI can show "AI is offline" instead of dying. */

function stripThink(t) {
  t = (t || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return t.includes("<think>") ? t.split("<think>")[0].trim() : t;
}

let _key = null;
let _keyTried = false;
function key() {
  if (_key !== null) return _key;
  if (_keyTried) return null;
  _keyTried = true;
  try {
    const alt = process.env.MINIMAX_API_KEY || process.env.MiniMax_API_KEY;
    if (alt) _key = alt.trim();
  } catch {
    _key = null;
  }
  return _key;
}
function isConfigured() { return !!key(); }

const DEFAULTS = {
  model: "MiniMax-M3",
  maxTokens: 1500,
  temperature: 0.4,
  timeoutMs: 25000,
  retries: 2,
  backoffMs: 700,
};

/* one HTTP attempt, with abort-based timeout. throws on non-2xx + gives a
   short, user-meaningful message (the previous version threw raw Error
   objects with no context, which bubbled to the UI as "couldn't reach
   the m3 model: TypeError: fetch failed"). */
async function oneAttempt(messages, opts) {
  const k = key();
  if (!k) throw new Error("MINIMAX_API_KEY not set — add it in Donna Settings or your environment");
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    const r = await fetch("https://api.minimax.io/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
      }),
      signal: ac.signal,
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      const err = new Error(`MiniMax ${r.status}: ${body.slice(0, 200) || r.statusText}`);
      err.status = r.status;
      throw err;
    }
    const d = await r.json();
    const content = d.choices?.[0]?.message?.content || "";
    return stripThink(content);
  } finally { clearTimeout(to); }
}

/* Retry on network errors / 5xx. Don't retry 4xx (bad key, bad request). */
async function askMinimax(prompt, { system, model, maxTokens, temperature, timeoutMs, retries, backoffMs } = {}) {
  const opts = { ...DEFAULTS, model: model || DEFAULTS.model,
    maxTokens: maxTokens || DEFAULTS.maxTokens,
    temperature: temperature == null ? DEFAULTS.temperature : temperature,
    timeoutMs: timeoutMs || DEFAULTS.timeoutMs,
    retries: retries == null ? DEFAULTS.retries : retries,
    backoffMs: backoffMs || DEFAULTS.backoffMs };
  if (!isConfigured()) return "(MINIMAX_API_KEY not set)";
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });
  let lastErr = null;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try { return await oneAttempt(messages, opts); }
    catch (e) {
      lastErr = e;
      const transient = e.name === "AbortError" || !e.status || e.status >= 500;
      if (!transient || attempt === opts.retries) break;
      await new Promise((r) => setTimeout(r, opts.backoffMs * Math.pow(2, attempt)));
    }
  }
  return `(M3 unavailable: ${lastErr?.message || "unknown error"})`;
}

module.exports = { askMinimax, stripThink, isConfigured };
