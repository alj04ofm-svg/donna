"use strict";

/* Google Gemini client — bring your own key (GEMINI_API_KEY). */

const DEFAULTS = {
  model: "gemini-3.6-flash",
  maxTokens: 1500,
  temperature: 0.5,
  timeoutMs: 30000,
};

function isConfigured() {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

async function askGemini(prompt, { system, model, maxTokens, temperature, timeoutMs } = {}) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return "(GEMINI_API_KEY not set)";
  const m = model || process.env.DONNA_GEMINI_MODEL || DEFAULTS.model;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs || DEFAULTS.timeoutMs);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: system ? `${system}\n\n---\n\n${prompt}` : prompt }] }],
          generationConfig: {
            temperature: temperature == null ? DEFAULTS.temperature : temperature,
            maxOutputTokens: maxTokens || DEFAULTS.maxTokens,
          },
        }),
        signal: ac.signal,
      }
    );
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return `(Gemini ${r.status}: ${body.slice(0, 180) || r.statusText})`;
    }
    const d = await r.json();
    return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  } catch (e) {
    return `(Gemini unavailable: ${e.message})`;
  } finally {
    clearTimeout(to);
  }
}

module.exports = { askGemini, isConfigured };
