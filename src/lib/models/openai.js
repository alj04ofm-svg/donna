"use strict";

/* OpenAI-compatible client. Works with OpenAI itself AND with OpenCode Zen /
   OpenCode Go (https://opencode.ai/zen/go/v1), which needs an extra
   `x-opencode-session` header. Key + base URL + model come from the app config
   (exposed as env by main.js): OPENAI_API_KEY, OPENAI_BASE_URL, DONNA_MODEL. */

const DEFAULTS = {
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
  maxTokens: 1500,
  temperature: 0.4,
  timeoutMs: 45000,
};

function baseUrl() {
  return (process.env.OPENAI_BASE_URL || DEFAULTS.baseUrl).replace(/\/$/, "");
}
function isOpencodeHost(u) { return /opencode\.ai/i.test(u || ""); }

function isConfigured() {
  return !!(process.env.OPENAI_API_KEY || process.env.OPENCODE_API_KEY);
}

async function askOpenAI(prompt, { system, model, maxTokens, temperature, timeoutMs } = {}) {
  const key = process.env.OPENCODE_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return "(no OpenCode/OpenAI key set — add one in Settings)";
  const base = baseUrl();
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs || DEFAULTS.timeoutMs);
  try {
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    /* OpenCode Go routes by session for efficiency + fair use. */
    if (isOpencodeHost(base)) {
      if (!process.env.OPENCODE_SESSION) {
        try { process.env.OPENCODE_SESSION = require("node:crypto").randomUUID(); } catch { process.env.OPENCODE_SESSION = `donna-${Date.now()}`; }
      }
      headers["x-opencode-session"] = process.env.OPENCODE_SESSION;
    }
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model || process.env.DONNA_MODEL || DEFAULTS.model,
        messages,
        max_tokens: maxTokens || DEFAULTS.maxTokens,
        temperature: temperature == null ? DEFAULTS.temperature : temperature,
      }),
      signal: ac.signal,
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      let msg = body.slice(0, 200) || r.statusText;
      try { const j = JSON.parse(body); msg = (j.error && (j.error.message || j.error.type)) || msg; } catch {}
      return `(AI ${r.status}: ${msg})`;
    }
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    return `(AI unavailable: ${e.message})`;
  } finally {
    clearTimeout(to);
  }
}

module.exports = { askOpenAI, isConfigured };
