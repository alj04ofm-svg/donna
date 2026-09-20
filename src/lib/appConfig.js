"use strict";

/**
 * Per-user configuration. Stored in the OS app-data directory so it survives
 * app updates and never lives inside the (read-only, signed) app bundle.
 *
 * API keys may also be supplied via environment variables, which always win:
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, MINIMAX_API_KEY, GROQ_API_KEY
 */

const fs = require("fs");
const path = require("path");
const { BASE } = require("./paths");

const FILE = path.join(BASE, "config.json");

const DEFAULTS = {
  // Identity
  userName: "",
  onboarded: false,

  // Window / behaviour
  hotkey: "CommandOrControl+Shift+Space",
  captureHotkey: "Alt+Space",
  launchAtLogin: false,
  notifications: true,
  voice: false,

  // Planning
  capacityHours: 8,
  dayStartHour: 9,
  dayEndHour: 19,

  // The assistant's knowledge: files or folders the user chooses to let it read.
  contextRoots: [],

  // AI provider — bring your own key.
  provider: "anthropic", // anthropic | openai | minimax | claude-cli
  model: "",
  apiKey: "",

  // Desktop orb position (null = default bottom-right)
  orbX: null,
  orbY: null,
};

function load() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    /* first run */
  }
  return { ...DEFAULTS, ...saved };
}

function save(cfg) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  } catch {
    /* best effort */
  }
}

function providerKey(cfg) {
  const provider = cfg.provider || "anthropic";
  const env = process.env;
  if (provider === "anthropic") return env.ANTHROPIC_API_KEY || cfg.apiKey || "";
  if (provider === "openai") return env.OPENAI_API_KEY || cfg.apiKey || "";
  if (provider === "minimax") return env.MINIMAX_API_KEY || cfg.apiKey || "";
  if (provider === "gemini") return env.GEMINI_API_KEY || cfg.apiKey || "";
  return cfg.apiKey || "";
}

module.exports = { load, save, providerKey, FILE, DEFAULTS };
