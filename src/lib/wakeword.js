const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");
const { execSync } = require("node:child_process");

/* Wake word — "Donna, ..." activates her, hands-free. No mic pipeline of our
   own to build: Alex already dictates everywhere through FluidVoice, and the
   Tracker already reads its transcription history for voice-note counts.
   Same source, read further: if a fresh dictation starts with "donna", strip
   the name and treat the rest as a spoken question. Cheap, local, no wake-word
   model, no extra permission prompt beyond what FluidVoice already has. */

const PLIST = path.join(process.env.HOME, "Library/Preferences/com.FluidApp.app.plist");
const STATE_FILE = dataPath("wakeword-state.json");
const WAKE_RE = /^\s*(hey\s+)?donn?a[,:]?\s+/i;

function readState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return { lastTs: Date.now() / 1000 - 978307200 }; } }
function writeState(s) { try { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch {} }

function readEntries() {
  try {
    const xml = execSync(`plutil -extract TranscriptionHistoryEntries xml1 -o - "${PLIST}"`, { encoding: "utf8", timeout: 3000 });
    const m = xml.match(/<data>([\s\S]*?)<\/data>/);
    if (!m) return [];
    return JSON.parse(Buffer.from(m[1].replace(/\s/g, ""), "base64").toString("utf8"));
  } catch { return []; }
}

/* poll every 4s — cheap (one plutil shellout + JSON parse), no reason for
   anything faster than "feels instant" for a dictated command */
function start(onWake) {
  let state = readState();
  const tick = () => {
    const entries = readEntries();
    let maxTs = state.lastTs;
    for (const e of entries) {
      if (!e.timestamp || e.timestamp <= state.lastTs) continue;
      maxTs = Math.max(maxTs, e.timestamp);
      const text = (e.rawText || "").trim();
      const m = text.match(WAKE_RE);
      if (m) onWake(text.slice(m[0].length).trim());
    }
    if (maxTs !== state.lastTs) { state = { lastTs: maxTs }; writeState(state); }
  };
  tick();
  const t = setInterval(tick, 4000);
  return { stop: () => clearInterval(t) };
}

module.exports = { start };
