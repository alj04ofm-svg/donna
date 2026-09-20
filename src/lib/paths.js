"use strict";

/**
 * Central path resolution for Donna.
 *
 * All durable user data lives in the OS app-data directory, never inside the
 * app bundle (which is read-only once packaged):
 *
 *   macOS: ~/Library/Application Support/Donna/data
 *
 * Works both packaged and when running from a source checkout.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

function resolveBase() {
  try {
    // Prefer Electron's userData (matches the app name set in main.js).
    const { app } = require("electron");
    if (app && typeof app.getPath === "function") {
      const p = app.getPath("userData");
      if (p) return p;
    }
  } catch {
    /* not running under Electron (tests, node scripts) */
  }
  return path.join(os.homedir(), "Library", "Application Support", "Donna");
}

const BASE = resolveBase();
const DATA = path.join(BASE, "data");
const TRACKER = path.join(DATA, "tracker");
const SHOTS = path.join(DATA, "screenshots");

for (const dir of [BASE, DATA, TRACKER, SHOTS]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* best effort; callers also guard writes */
  }
}

function dataPath(...parts) {
  return path.join(DATA, ...parts);
}

function basePath(...parts) {
  return path.join(BASE, ...parts);
}

module.exports = { BASE, DATA, TRACKER, SHOTS, dataPath, basePath };
