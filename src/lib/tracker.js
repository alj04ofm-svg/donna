const { execSync, exec } = require("node:child_process");
const { dataPath } = require("./paths");
const fs = require("node:fs");
const path = require("node:path");
const categories = require("./categories");

/* The Tracker v2 — ActivityWatch capture × RescueTime scoring × Rize coaching
   × Hubstaff evidence, ALL LOCAL. Self-memory, never proof-of-work.

   Engine: every 4s read {app, title, url} (get-windows when permissions allow,
   lsappinfo fallback = app-only mode) + system idle. Consecutive identical
   samples MERGE into one duration event (heartbeat/pulsetime) — a workday is a
   few hundred events, ~50KB. Idle >180s marks AFK retroactively to the last
   input; AFK time masks events at query time so every stat means ACTIVE time.
   Categorization/scoring happen at read time from categories.js rules, so
   rule edits re-score all history. Screenshots stay on a 10-min cadence as the
   evidence trail, auto-pruned after 14 days. */

const DATA = dataPath("tracker");
const SHOTS_DEFAULT = dataPath("screenshots");
const SAMPLE_MS = 4000;            // heartbeat cadence
const PULSE_S = 12;                // merge window: same activity within 12s extends the event
const AFK_S = 180;                 // idle beyond this = away, retroactive to last input

/* Tracker settings — user-tunable, not hardcoded (Alex asked for retention
   days, screenshot cadence, save location, on/off in one place). Persisted
   separately from the general app config so a bad path can't wedge boot. */
const TCFG_FILE = dataPath("tracker-config.json");
const TCFG_DEFAULT = { shotIntervalMin: 10, keepDays: 14, shotsEnabled: true, saveDir: null };
function readTCfg() { try { return { ...TCFG_DEFAULT, ...JSON.parse(fs.readFileSync(TCFG_FILE, "utf8")) }; } catch { return { ...TCFG_DEFAULT }; } }
let tcfg = readTCfg();
function writeTCfg() { try { fs.mkdirSync(path.dirname(TCFG_FILE), { recursive: true }); fs.writeFileSync(TCFG_FILE, JSON.stringify(tcfg)); } catch {} }
const SHOTS = () => tcfg.saveDir || SHOTS_DEFAULT;
function getTrackerConfig() { return { ...tcfg }; }
function setTrackerConfig(patch) {
  const wasEnabled = tcfg.shotsEnabled, wasInterval = tcfg.shotIntervalMin;
  tcfg = { ...tcfg, ...patch };
  writeTCfg();
  if (tracking && (tcfg.shotsEnabled !== wasEnabled || tcfg.shotIntervalMin !== wasInterval)) {
    clearInterval(shTimer); shTimer = null;
    if (tcfg.shotsEnabled) shTimer = setInterval(shot, tcfg.shotIntervalMin * 60 * 1000);
  }
  return getTrackerConfig();
}

const day = () => new Date().toISOString().slice(0, 10);
const evFile = (d) => path.join(DATA, `${d || day()}.events.json`);

const readEvents = (d) => { try { return JSON.parse(fs.readFileSync(evFile(d), "utf8")); } catch { return { date: d || day(), events: [], afk: [], shots: [], voiceToday: 0 }; } };
let today_ = readEvents();            // live day buffer (flushed on interval + close)
let dirty = false;
function flush() { if (!dirty) return; try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(evFile(today_.date), JSON.stringify(today_)); dirty = false; } catch {} }
function rollDay() { if (today_.date !== day()) { flush(); today_ = readEvents(); } }

/* ── capture: get-windows (title+url, needs Screen Recording) → lsappinfo (app only) ── */
let getWindowsFn = null;
import("get-windows").then((m) => (getWindowsFn = m.activeWindow)).catch(() => {});
function frontAppFallback() {
  try { const asn = execSync("lsappinfo front", { encoding: "utf8", timeout: 1500 }).trim(); const o = execSync(`lsappinfo info -only name ${asn}`, { encoding: "utf8", timeout: 1500 }); const m = o.match(/=\s*"([^"]+)"/); return m ? m[1] : null; }
  catch { return null; }
}
async function readActive() {
  if (getWindowsFn) {
    try {
      // never let get-windows raise its own permission prompts — use whatever's
      // already granted to the Electron runtime; missing perms just drop the
      // window title/url rather than nagging.
      const w = await getWindowsFn({ screenRecordingPermission: false, accessibilityPermission: false });
      if (w && w.owner && w.owner.name) return { app: w.owner.name, title: (w.title || "").slice(0, 160) || null, url: w.url || null };
    } catch {}
  }
  const app_ = frontAppFallback();
  return app_ ? { app: app_, title: null, url: null } : null;
}

function idleSec() {
  try { const { powerMonitor } = require("electron"); if (powerMonitor && powerMonitor.getSystemIdleTime) return powerMonitor.getSystemIdleTime(); } catch {}
  try { const o = execSync("ioreg -c IOHIDSystem | grep -m1 HIDIdleTime", { encoding: "utf8" }); const m = o.match(/=\s*(\d+)/); return m ? Math.round(Number(m[1]) / 1e9) : 999; }
  catch { return 999; }
}

/* FluidVoice dictation history — voice counts as presence (Alex works by voice). */
function voiceEvents() {
  try {
    const PLIST = path.join(process.env.HOME, "Library/Preferences/com.FluidApp.app.plist");
    const xml = execSync(`plutil -extract TranscriptionHistoryEntries xml1 -o - "${PLIST}"`, { encoding: "utf8", timeout: 3000 });
    const m = xml.match(/<data>([\s\S]*?)<\/data>/);
    if (!m) return { today: 0, sinceSec: 1e9 };
    const entries = JSON.parse(Buffer.from(m[1].replace(/\s/g, ""), "base64").toString("utf8"));
    const OFFSET = 978307200, nowCF = Date.now() / 1000 - OFFSET;
    const todayStartCF = new Date(new Date().toDateString()).getTime() / 1000 - OFFSET;
    const today = entries.filter((e) => e.timestamp >= todayStartCF).length;
    const maxTs = entries.reduce((mx, e) => Math.max(mx, e.timestamp || 0), 0);
    return { today, sinceSec: maxTs ? Math.round(nowCF - maxTs) : 1e9 };
  } catch { return { today: 0, sinceSec: 1e9 }; }
}

/* ── the heartbeat ── */
let sTimer = null, shTimer = null, flTimer = null, tracking = false;
let afkOpen = null;      // {s} epoch-seconds when the current away-block started
let onNudge = null;      // main injects a notifier; nudges are RATIONED there
let distractRunS = 0, workRunS = 0, lastNudge = { distract: 0, break: 0 };

async function sample() {
  rollDay();
  const nowS = Math.floor(Date.now() / 1000);
  const idle = idleSec();
  const v = voiceEvents();
  today_.voiceToday = v.today;
  const present = idle < AFK_S || v.sinceSec < 45;

  if (!present) {
    if (!afkOpen) { afkOpen = { s: nowS - idle }; }           // retroactive to last input
  } else if (afkOpen) {
    today_.afk.push({ s: afkOpen.s, e: nowS - idle });         // close the away block
    afkOpen = null; dirty = true;
  }

  const act = await readActive();
  if (act && present) {
    const evs = today_.events;
    const last = evs[evs.length - 1];
    if (last && last.app === act.app && last.title === act.title && last.url === act.url && nowS - (last.s + last.d) <= PULSE_S) {
      last.d = nowS - last.s;                                  // heartbeat merge — extend
    } else {
      evs.push({ s: nowS, d: SAMPLE_MS / 1000, app: act.app, title: act.title, url: act.url });
    }
    dirty = true;

    /* nudge runs (Rize): continuous distracting vs continuous real work */
    const { level } = categories.classify(act);
    if (level < 0) { distractRunS += SAMPLE_MS / 1000; workRunS = 0; }
    else if (level > 0) { workRunS += SAMPLE_MS / 1000; distractRunS = 0; }
    else { distractRunS = 0; }
    if (onNudge && distractRunS >= 20 * 60 && nowS - lastNudge.distract > 3600) {
      lastNudge.distract = nowS; distractRunS = 0;
      onNudge({ kind: "distract", title: "20 minutes adrift", body: `${act.app} has had you 20 min — back to it?` });
    }
    if (onNudge && workRunS >= 90 * 60 && nowS - lastNudge.break > 3600) {
      lastNudge.break = nowS; workRunS = 0;
      onNudge({ kind: "break", title: "90 minutes deep", body: "Solid run. Stand up, water, two minutes — then back." });
    }
  } else { distractRunS = 0; workRunS = 0; }
}

function shot() {
  if (!tcfg.shotsEnabled) return;
  const dir = SHOTS();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, ts + ".jpg"), thumb = path.join(dir, ts + "_t.jpg");
  exec(`screencapture -x -t jpg "${full}" && sips -Z 560 "${full}" --out "${thumb}" >/dev/null 2>&1`, () => {
    rollDay();
    today_.shots.push({ at: new Date().toISOString(), full, thumb });
    dirty = true; flush();
  });
}
function pruneShots() {
  try {
    const cutoff = Date.now() - tcfg.keepDays * 86400000;
    const dir = SHOTS();
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try { if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p); } catch {}
    }
  } catch {}
}

function start() {
  if (tracking) return { tracking };
  tracking = true;
  sample(); shot(); pruneShots();
  sTimer = setInterval(sample, SAMPLE_MS);
  if (tcfg.shotsEnabled) shTimer = setInterval(shot, tcfg.shotIntervalMin * 60 * 1000);
  flTimer = setInterval(flush, 30000);
  try { // close events cleanly around sleep/lock — no phantom hours
    const { powerMonitor } = require("electron");
    powerMonitor.on("suspend", pause); powerMonitor.on("lock-screen", pause);
    powerMonitor.on("resume", resume); powerMonitor.on("unlock-screen", resume);
  } catch {}
  return { tracking };
}
function pause() { const nowS = Math.floor(Date.now() / 1000); if (!afkOpen) afkOpen = { s: nowS }; flush(); }
function resume() { if (afkOpen) { today_.afk.push({ s: afkOpen.s, e: Math.floor(Date.now() / 1000) }); afkOpen = null; dirty = true; } }
function stop() { tracking = false; clearInterval(sTimer); clearInterval(shTimer); clearInterval(flTimer); sTimer = shTimer = flTimer = null; flush(); return { tracking }; }
function toggle() { return tracking ? stop() : start(); }

/* ── analytics, all computed at read time ── */
function maskAfk(events, afk) {
  // subtract away-blocks from each event; drop what vanishes
  const out = [];
  for (const ev of events) {
    let segs = [[ev.s, ev.s + ev.d]];
    for (const a of afk) {
      segs = segs.flatMap(([s, e]) => {
        if (a.e <= s || a.s >= e) return [[s, e]];
        const keep = [];
        if (a.s > s) keep.push([s, a.s]);
        if (a.e < e) keep.push([a.e, e]);
        return keep;
      });
    }
    for (const [s, e] of segs) if (e - s >= 4) out.push({ ...ev, s, d: e - s });
  }
  return out;
}

function computeDay(dateStr) {
  const raw = dateStr && dateStr !== today_.date ? readEvents(dateStr) : today_;
  const afk = [...raw.afk, ...(afkOpen ? [{ s: afkOpen.s, e: Math.floor(Date.now() / 1000) }] : [])];
  const rs = categories.rules();
  const events = maskAfk(raw.events, afk).map((ev) => {
    const c = categories.classify(ev, rs);
    return { ...ev, cat: c.cat, level: c.level, hue: categories.hueOf(c.cat) };
  });

  const activeS = events.reduce((n, e) => n + e.d, 0);
  const byCat = {}, byApp = {};
  for (const e of events) {
    byCat[e.cat] = byCat[e.cat] || { cat: e.cat, s: 0, level: e.level, hue: e.hue };
    byCat[e.cat].s += e.d;
    byApp[e.app] = byApp[e.app] || { app: e.app, s: 0 };
    byApp[e.app].s += e.d;
  }
  /* Pulse 0–100 (RescueTime): time-weighted levels −2..+2 → 0..4 scale */
  let wsum = 0;
  for (const c of Object.values(byCat)) wsum += (c.level + 2) * c.s;
  const pulse = activeS ? Math.round((wsum / (activeS * 4)) * 100) : 0;

  /* focus sessions (Rize): ≥25 min contiguous where productive share ≥80%
     and gaps between events ≤90s; switches counted across the whole day */
  const sessions = [];
  let cur = null;
  for (const e of events) {
    if (cur && e.s - cur.e <= 90) { cur.e = e.s + e.d; cur.total += e.d; if (e.level > 0) cur.prod += e.d; cur.evs++; }
    else { if (cur) sessions.push(cur); cur = { s: e.s, e: e.s + e.d, total: e.d, prod: e.level > 0 ? e.d : 0, evs: 1 }; }
  }
  if (cur) sessions.push(cur);
  const focus = sessions.filter((x) => x.e - x.s >= 25 * 60 && x.prod / Math.max(1, x.total) >= 0.8);
  const deepS = focus.reduce((n, x) => n + (x.e - x.s), 0);
  const longest = focus.reduce((mx, x) => Math.max(mx, x.e - x.s), 0);
  let switches = 0;
  for (let i = 1; i < events.length; i++) if (events[i].app !== events[i - 1].app) switches++;
  const switchesPerHr = activeS ? Math.round(switches / (activeS / 3600)) : 0;

  const shots = (raw.shots || []).map((sh) => ({ at: sh.at, full: sh.full, thumb: sh.thumb, t: Math.floor(new Date(sh.at).getTime() / 1000) }));

  return {
    date: raw.date, tracking,
    activeMin: Math.round(activeS / 60),
    pulse, deepMin: Math.round(deepS / 60), longestMin: Math.round(longest / 60),
    switchesPerHr, focusCount: focus.length,
    voiceToday: raw.voiceToday || 0,
    cats: Object.values(byCat).map((c) => ({ ...c, min: Math.round(c.s / 60) })).sort((a, b) => b.s - a.s),
    apps: Object.values(byApp).map((a) => ({ ...a, min: Math.round(a.s / 60) })).sort((a, b) => b.s - a.s).slice(0, 8),
    timeline: events.map((e) => ({ s: e.s, d: e.d, app: e.app, title: e.title, url: e.url, cat: e.cat, level: e.level, hue: e.hue })),
    afk: afk.filter((a) => a.e - a.s >= 60),
    shots: shots.slice(-40),
    appOnly: events.length > 0 && !events.some((e) => e.title), // no titles yet = Screen Recording not granted
  };
}

/* pulse history for the trend sparkline — last n days incl. today */
function history(nDays = 14) {
  const out = [];
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    try {
      const c = computeDay(ds);
      out.push({ date: ds, pulse: c.pulse, activeMin: c.activeMin, deepMin: c.deepMin });
    } catch { out.push({ date: ds, pulse: 0, activeMin: 0, deepMin: 0 }); }
  }
  return out;
}

/* thumbnail as data-uri for the evidence drawer */
function shotThumb(p) {
  try { return "data:image/jpeg;base64," + fs.readFileSync(p).toString("base64"); } catch { return null; }
}

/* legacy shim — the old vRhythm called today(); keep a compatible surface
   while the new page migrates to computeDay() */
function today() {
  const c = computeDay();
  return {
    tracking, trackedMin: c.activeMin, activePct: 100, prodPct: c.pulse,
    apps: c.apps.map((a) => ({ name: a.app, min: a.min, kind: "prod" })),
    shots: c.shots.slice(-12).reverse().map((s) => ({ at: s.at, full: s.full, app: "", thumbData: shotThumb(s.thumb) })).filter((s) => s.thumbData),
    voiceDictations: c.voiceToday,
  };
}

function setNudge(fn) { onNudge = fn; }

module.exports = { start, stop, toggle, today, computeDay, history, shotThumb, setNudge, status: () => ({ tracking }), getTrackerConfig, setTrackerConfig };
