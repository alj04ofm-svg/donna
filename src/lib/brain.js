"use strict";

const { route } = require("./router");
const { buildContext } = require("./contextProvider");
const { parseCapture } = require("./captureIntent");

function systemPrompt(cfg) {
  const c = cfg || {};
  const who = c.userName && String(c.userName).trim() ? String(c.userName).trim() : "the user";
  const lines = [
    `You are Donna, a sharp, warm personal assistant. Address the user as ${who}.`,
  ];
  if (c.profileRole) lines.push(`Their role: ${String(c.profileRole).slice(0, 120)}.`);
  if (c.profileFocus) lines.push(`What they're focused on right now: ${String(c.profileFocus).slice(0, 160)}.`);
  if (c.profileStyle) lines.push(`Answer style they prefer: ${String(c.profileStyle).slice(0, 120)}.`);
  lines.push(
    "You only know what is in the CONTEXT below plus general knowledge — never invent specifics about their life.",
    "Answer fast and direct, no fluff, no flattery. Lead with the answer; end with a concrete next action when useful.",
    "If you don't know, say so plainly.",
  );
  return lines.join(" ");
}

function createBrain({ config, captureStore, clients }) {
  const cfg = config || {};

  async function ask(text, { onToken, onState } = {}) {
    // plain-language task commands ("complete the invoice", "roll overdue to
    // today") run locally and instantly — no model call, fully deterministic.
    try {
      const act = require("./nlActions").run(text);
      if (act && act.handled) {
        onToken && onToken(act.message);
        return { answer: act.message, tier: "action", provider: "action" };
      }
    } catch {}
    const cap = parseCapture(text);
    if (cap) {
      captureStore.add(cap.kind, cap.text);
      const answer = `Got it — ${cap.kind} added: "${cap.text}".`;
      onToken && onToken(answer);
      return { answer, tier: "capture", provider: "capture" };
    }
    onState && onState("thinking");
    const { tier, text: clean } = route(text);
    const context = await buildContext({ roots: cfg.contextRoots || [], captureStore });
    let mem = "";
    try {
      mem = require("./memory").promptBlock();
    } catch {}
    const prompt = `CONTEXT:\n${context}\n\n${mem ? mem + "\n\n" : ""}---\n\nUser: ${clean}`;
    // read the provider live so changing it in Settings takes effect at once
    const provider = cfg.provider || "opencode";
    const fn = clients[provider] || clients.opencode || clients.anthropic || Object.values(clients)[0];
    let answer = "";
    try {
      answer = await fn(prompt, systemPrompt(cfg));
    } catch (e) {
      answer = `(couldn't reach the ${provider} model: ${e.message})`;
    }
    onState && onState("idle");
    onToken && onToken(answer);
    return { answer, tier, provider };
  }

  return { ask };
}

module.exports = { createBrain, systemPrompt };
