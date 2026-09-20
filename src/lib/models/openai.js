"use strict";

/* OpenAI client — bring your own key (OPENAI_API_KEY). */

const DEFAULTS = {
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
  maxTokens: 1500,
  temperature: 0.4,
  timeoutMs: 30000,
};

function baseUrl() {
  return (process.env.OPENAI_BASE_URL || DEFAULTS.baseUrl).replace(/\/$/, "");
}

function isConfigured() {
  return !!(process.env.OPENAI_API_KEY || process.env.OPENCODE_API_KEY);
}

async function askOpenAI(prompt, { system, model, maxTokens, temperature, timeoutMs } = {}) {
  const key = process.env.OPENCODE_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return "(OPENAI_API_KEY not set)";
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs || DEFAULTS.timeoutMs);
  try {
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    const r = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
      return `(OpenAI ${r.status}: ${body.slice(0, 180) || r.statusText})`;
    }
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    return `(OpenAI unavailable: ${e.message})`;
  } finally {
    clearTimeout(to);
  }
}

module.exports = { askOpenAI, isConfigured };
