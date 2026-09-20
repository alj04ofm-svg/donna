"use strict";

/**
 * Production snapshot — optional "pack".
 *
 * The original build wired this to a specific content operation (local pipeline
 * files + a dashboard bridge). The public build ships without it; if a user has
 * an external pipeline they can supply their own adapter. Everything here is
 * inert so the UI degrades to a friendly empty state.
 */

function snapshot() {
  return {
    ok: false,
    stages: [],
    ready: { n: 0 },
    generated: { n: 0, present: false },
    voiceSwap: { n: 0, files: [] },
    postReady: { n: 0, accounts: [] },
    note: "No production pipeline configured.",
  };
}

async function liveSnapshot() {
  return snapshot();
}

function agents() {
  return [];
}

module.exports = { snapshot, liveSnapshot, agents };
