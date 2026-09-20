"use strict";

/* Anthropic Claude client — bring your own key (ANTHROPIC_API_KEY). */

const DEFAULTS = {
  model: "claude-sonnet-4-5",
  maxTokens: 1500,
  temperature: 0.4,
  timeoutMs: 30000,
};

function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function askAnthropic(prompt, { system, model, maxTokens, temperature, timeoutMs } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "(ANTHROPIC_API_KEY not set)";
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs || DEFAULTS.timeoutMs);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model || DEFAULTS.model,
        max_tokens: maxTokens || DEFAULTS.maxTokens,
        temperature: temperature == null ? DEFAULTS.temperature : temperature,
        system: system || undefined,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: ac.signal,
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return `(Anthropic ${r.status}: ${body.slice(0, 180) || r.statusText})`;
    }
    const d = await r.json();
    return (d.content || []).map((c) => c.text || "").join("").trim();
  } catch (e) {
    return `(Anthropic unavailable: ${e.message})`;
  } finally {
    clearTimeout(to);
  }
}

module.exports = { askAnthropic, isConfigured };
