"use strict";

const { route } = require("./router");
const { buildContext } = require("./contextProvider");
const { parseCapture } = require("./captureIntent");

function systemPrompt(userName) {
  const who = userName && String(userName).trim() ? String(userName).trim() : "the user";
  return [
    `You are Donna, a sharp, warm personal assistant. Address the user as ${who}.`,
    "You only know what is in the CONTEXT below plus general knowledge — never invent specifics about their life.",
    "Answer fast and direct, no fluff, no flattery. Lead with the answer; end with a concrete next action when useful.",
    "If you don't know, say so plainly.",
  ].join(" ");
}

function createBrain({ config, captureStore, clients }) {
  const cfg = config || {};
  const SYSTEM = systemPrompt(cfg.userName);
  const provider = cfg.provider || "anthropic";

  async function ask(text, { onToken, onState } = {}) {
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
    const fn = clients[provider] || clients.anthropic || Object.values(clients)[0];
    let answer = "";
    try {
      answer = await fn(prompt, SYSTEM);
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
