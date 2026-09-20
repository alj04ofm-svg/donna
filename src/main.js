const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, ipcMain, screen, Notification } = require("electron");
const path = require("path");
const fs = require("node:fs");

// Ensure CLIs (claude, python) resolve inside Electron's env.
process.env.PATH = `${process.env.HOME || ""}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ""}`;

app.setName("Donna");

// Single instance — clicking Donna while she's already open must focus the
// existing window, never spawn a second. Second launch -> showWindow.
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on("second-instance", () => { try { showWindow(); } catch {} });

const { createBrain } = require("./lib/brain");
const { createCaptureStore } = require("./lib/captureStore");
const { askAnthropic } = require("./lib/models/anthropic");
const { askOpenAI } = require("./lib/models/openai");
const { askMinimax } = require("./lib/models/minimax");
const { askClaude } = require("./lib/models/claudeCli");
const appConfig = require("./lib/appConfig");
const tasks = require("./lib/tasks");
const production = require("./lib/production");
const { createWatchers } = require("./lib/watchers");
const { dataPath } = require("./lib/paths");

const config = appConfig.load();
const captureStore = createCaptureStore(dataPath("capture.json"));
const clients = {
  anthropic: (p, s) => askAnthropic(p, { system: s }),
  openai: (p, s) => askOpenAI(p, { system: s }),
  minimax: (p, s) => askMinimax(p, { system: s }),
  "claude-cli": (p, s) => askClaude(p, { model: "claude-opus-4-8", system: s }),
};
const brain = createBrain({ config, captureStore, clients });

let voice = null;
if (config.voice && config.voiceRef) {
  const { createVoice } = require("./lib/voice");
  voice = createVoice({ ref: config.voiceRef, venvPython: path.join(__dirname, "../.venv/bin/python") });
}

/* ─── window states: FULL ⇄ COMPACT ⇄ PILL, corner-anchored bottom-right ───
   setBounds(bounds, animate:true) freezes Chromium paint mid-resize (electron#4368),
   so all morphs run a manual eased bounds loop in main. */

const MODES = {
  full: { w: 1200, h: 820 },
  compact: { w: 384, h: 560 },
  pill: { w: 268, h: 44 },
};
let mode = "full";
let fullBounds = null;
let win = null;
let tray = null;
let animating = false;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function animateBounds(w, to, dur = 210) {
  const from = w.getBounds();
  const start = Date.now();
  animating = true;
  return new Promise((res) => {
    (function step() {
      const t = Math.min(1, (Date.now() - start) / dur);
      const e = easeInOutCubic(t);
      w.setBounds({
        x: Math.round(from.x + (to.x - from.x) * e),
        y: Math.round(from.y + (to.y - from.y) * e),
        width: Math.round(from.width + (to.width - from.width) * e),
        height: Math.round(from.height + (to.height - from.height) * e),
      });
      if (t < 1) setTimeout(step, 8);
      else { animating = false; res(); }
    })();
  });
}

function cursorWorkArea() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}
function bottomRight(w, h, margin = 16) {
  const wa = cursorWorkArea();
  return { x: wa.x + wa.width - w - margin, y: wa.y + wa.height - h - margin, width: w, height: h };
}
function clampToWork(b) {
  const wa = cursorWorkArea();
  return {
    x: Math.min(Math.max(b.x, wa.x), wa.x + wa.width - b.width),
    y: Math.min(Math.max(b.y, wa.y), wa.y + wa.height - b.height),
    width: b.width, height: b.height,
  };
}

async function applyMode(next) {
  if (!win || animating || next === mode) { if (win && next !== mode) {} else return; }
  if (mode === "full") fullBounds = win.getBounds();
  const prev = mode;
  mode = next;
  const m = MODES[mode];
  // renderer fades the outgoing layout first, then geometry moves
  win.webContents.send("donna:modeWill", mode);
  await new Promise((r) => setTimeout(r, 70));

  if (mode === "full") {
    win.setAlwaysOnTop(false);
    const target = fullBounds ? clampToWork(fullBounds) : (() => { const wa = cursorWorkArea(); return { x: wa.x + Math.round((wa.width - m.w) / 2), y: wa.y + Math.round((wa.height - m.h) / 2), width: m.w, height: m.h }; })();
    await animateBounds(win, target);
    win.setResizable(true);
    win.setMinimumSize(760, 500);
    if (win.setWindowButtonVisibility) win.setWindowButtonVisibility(true);
  } else {
    win.setAlwaysOnTop(true, "floating");
    if (win.setWindowButtonVisibility) win.setWindowButtonVisibility(false);
    // shrink the minimum FIRST, or the 760px floor clamps the compact/pill resize
    win.setMinimumSize(m.w, m.h);
    win.setResizable(false);
    await animateBounds(win, bottomRight(m.w, m.h, mode === "pill" ? 12 : 16));
  }
  win.webContents.send("donna:mode", mode);
  if (prev !== mode) win.show();
}

/* fade show/hide — no popping */
function fadeTo(target, dur = 120) {
  if (!win) return Promise.resolve();
  const from = win.getOpacity();
  const start = Date.now();
  return new Promise((res) => {
    (function step() {
      const t = Math.min(1, (Date.now() - start) / dur);
      win.setOpacity(from + (target - from) * t);
      t < 1 ? setTimeout(step, 12) : res();
    })();
  });
}
let attention = 0;
let notifyEnabled = config.notifications !== false;
function clearAttention() { attention = 0; updateTray(); }

/* menu-bar now/next strip (Notion Calendar) — the ambient face, seen 50×/day.
   Priority: attention badge > the task you're ON (live) > next reminder soon. */
function updateTray() {
  if (!tray) return;
  try {
    if (attention > 0) { tray.setTitle(` ${attention}`); return; }
    const doing = tasks.summary().open.find((t) => t.status === "doing");
    if (doing && doing.startedAt) {
      const m = Math.floor((Date.now() - new Date(doing.startedAt)) / 60000);
      tray.setTitle(` ▸ ${doing.title.slice(0, 16)}${doing.title.length > 16 ? "…" : ""} ${m >= 60 ? Math.floor(m / 60) + "h" + (m % 60 ? (m % 60) + "m" : "") : m + "m"}`);
      return;
    }
    const rem = require("./lib/reminders").list().filter((r) => !r.fired && new Date(r.at) > new Date())
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))[0];
    if (rem && new Date(rem.at) - Date.now() < 3600000) {
      tray.setTitle(` ⏰ ${Math.max(1, Math.round((new Date(rem.at) - Date.now()) / 60000))}m`);
      return;
    }
    tray.setTitle("");
  } catch {}
}

async function showWindow() {
  if (!win) createWindow();
  clearAttention();
  try { console.log("[showWindow] pre visible=", win.isVisible(), "opacity=", win.getOpacity(), "bounds=", JSON.stringify(win.getBounds())); } catch {}
  win.setOpacity(0);
  win.show(); win.focus(); app.focus({ steal: true });
  try { if (app.dock) app.dock.show(); } catch {}
  win.webContents.send("donna:show");
  await fadeTo(1);
  try { console.log("[showWindow] post visible=", win.isVisible(), "opacity=", win.getOpacity()); } catch {}
}
async function hideWindow() {
  if (!win) return;
  /* record last-seen so on next open the renderer can show what changed */
  try {
    /* ask the renderer to persist it; renderer writes localStorage */
    win.webContents.send("donna:hide");
  } catch {}
  await fadeTo(0); win.hide(); win.setOpacity(1);
}
function toggleWindow() { if (win && win.isVisible() && win.isFocused()) hideWindow(); else showWindow(); }

function createWindow() {
  win = new BrowserWindow({
    width: MODES.full.w, height: MODES.full.h, minWidth: 760, minHeight: 500, show: false,
    titleBarStyle: "hidden", trafficLightPosition: { x: 16, y: 16 },
    vibrancy: "under-window", visualEffectState: "active",
    backgroundColor: "#00000000", roundedCorners: true,
    // backgroundThrottling off: she keeps ticking (timers, tracker UI, entrance
    // animations) even when occluded/hidden — otherwise views render at opacity 0
    // behind fullscreen apps and live refresh stalls while she's in the tray.
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, backgroundThrottling: false },
  });
  const q = {};
  if (process.env.DONNA_START_VIEW) q.view = process.env.DONNA_START_VIEW;   // dev QA hook
  if (process.env.DONNA_START_LAYOUT) q.layout = process.env.DONNA_START_LAYOUT;
  win.loadFile(path.join(__dirname, "renderer/index.html"), { query: q });
  win.webContents.on("console-message", (_e, level, msg, line, src) => { if (level >= 2) console.log(`[renderer] ${msg} (${src}:${line})`); });
  win.webContents.on("render-process-gone", (_e, d) => console.log("[render-gone]", d.reason));
  win.webContents.on("did-fail-load", (_e, ec, desc, url) => console.log("[did-fail-load]", ec, desc, url));
  win.webContents.on("did-finish-load", () => console.log("[did-finish-load]"));
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); // companion follows Alex across Spaces
  win.on("close", (e) => { if (!app.isQuitting) { e.preventDefault(); hideWindow(); } });
}

/* ── the desktop orb — Donna loose on your screen, not locked in a window.
   Frameless/transparent/always-on-top, remembers where you left it, morphs
   between a 56px sphere and a small chat the same way the main window morphs
   full/compact/pill. Independent of whether the main window is open. ── */
const ORB_SMALL = { w: 56, h: 56 };
const ORB_BIG = { w: 300, h: 380 };
let orbWin = null;
function defaultOrbPos() {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - ORB_SMALL.w - 24, y: wa.y + wa.height - ORB_SMALL.h - 100 };
}
function createOrbWindow() {
  const pos = (config.orbX != null && config.orbY != null) ? { x: config.orbX, y: config.orbY } : defaultOrbPos();
  orbWin = new BrowserWindow({
    x: pos.x, y: pos.y, width: ORB_SMALL.w, height: ORB_SMALL.h,
    frame: false, transparent: true, backgroundColor: "#00000000", resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true },
  });
  orbWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  orbWin.loadFile(path.join(__dirname, "renderer/orb.html"));
  orbWin.webContents.on("console-message", (_e, level, msg, line, src) => { if (level >= 2) console.log(`[orb] ${msg} (${src}:${line})`); });
  orbWin.on("moved", () => {
    if (!orbWin) return;
    const b = orbWin.getBounds();
    Object.assign(config, { orbX: b.x, orbY: b.y });
    try { appConfig.save(config); } catch {}
  });
  orbWin.on("closed", () => { orbWin = null; });
}
function showOrb() { if (!orbWin) createOrbWindow(); orbWin.show(); }
function hideOrb() { if (orbWin) orbWin.hide(); }
function toggleOrb() { if (orbWin && orbWin.isVisible()) hideOrb(); else showOrb(); }
function setOrbExpanded(on) {
  if (!orbWin) return;
  const to = on ? ORB_BIG : ORB_SMALL;
  const b = orbWin.getBounds();
  // grow/shrink anchored to the orb's own corner, not the screen's — it
  // should feel like it's blooming in place, not teleporting.
  const wa = screen.getDisplayNearestPoint({ x: b.x, y: b.y }).workArea;
  const x = Math.max(wa.x, Math.min(wa.x + wa.width - to.w, b.x + b.width - to.w));
  const y = Math.max(wa.y, Math.min(wa.y + wa.height - to.h, b.y + b.height - to.h));
  orbWin.setResizable(true);
  orbWin.setBounds({ x, y, width: to.w, height: to.h });
  orbWin.setResizable(false);
}

/* ── global quick capture — a tiny top-of-screen bar summoned from anywhere.
   Context autofill (Things): the moment the hotkey fires we read the app you
   were in (and its URL/title if it's a browser) BEFORE our window steals
   focus, so the task remembers where it came from. ── */
let capWin = null;
let capContext = null;
function readCaptureContext() {
  // OFF by default: each `tell application "X"` fires a macOS Automation prompt
  // per target app — that's the permission spam. Opt in via config.captureContext
  // once (Settings) and it only asks per browser the first time.
  if (!config.captureContext) return null;
  const { execSync } = require("node:child_process");
  const run = (s) => { try { return execSync(`osascript -e '${s}'`, { encoding: "utf8", timeout: 900 }).trim(); } catch { return null; } };
  const app_ = run('tell application "System Events" to get name of first process whose frontmost is true');
  if (!app_ || app_ === "Electron" || app_ === "Donna") return null;
  const ctx = { app: app_, url: null, title: null };
  if (/Safari/i.test(app_)) { ctx.url = run('tell application "Safari" to get URL of front document'); ctx.title = run('tell application "Safari" to get name of front document'); }
  else if (/Chrome|Arc|Brave|Edge/i.test(app_)) {
    const target = /Arc/i.test(app_) ? "Arc" : /Brave/i.test(app_) ? "Brave Browser" : /Edge/i.test(app_) ? "Microsoft Edge" : "Google Chrome";
    ctx.url = run(`tell application "${target}" to get URL of active tab of front window`);
    ctx.title = run(`tell application "${target}" to get title of active tab of front window`);
  }
  return ctx;
}
function openQuickCapture() {
  capContext = readCaptureContext();
  if (!capWin) {
    capWin = new BrowserWindow({
      width: 600, height: 150, show: false, frame: false, resizable: false,
      alwaysOnTop: true, skipTaskbar: true, hasShadow: true,
      vibrancy: "hud", visualEffectState: "active", backgroundColor: "#00000000", roundedCorners: true,
      webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true },
    });
    capWin.loadFile(path.join(__dirname, "renderer/capture.html"));
    capWin.webContents.on("console-message", (_e, level, msg, line, src) => { if (level >= 2) console.log(`[capture] ${msg} (${src}:${line})`); });
    capWin.on("blur", () => { if (capWin && capWin.isVisible()) capWin.hide(); });
  }
  const wa = cursorWorkArea();
  capWin.setBounds({ x: wa.x + Math.round((wa.width - 600) / 2), y: wa.y + Math.round(wa.height * 0.22), width: 600, height: 150 });
  capWin.show(); capWin.focus();
  capWin.webContents.send("donna:captureCtx", capContext);
}

/* launch-at-login — points macOS at the packaged Donna.app if it's installed,
   else falls back to the running electron path. Driven by config.launchAtLogin
   so the Settings toggle owns it; reconciled on every boot so the OS setting
   never drifts from the app's own state. */
function syncLoginItem() {
  try {
    const opts = { openAtLogin: !!config.launchAtLogin, openAsHidden: false };
    if (process.execPath) opts.path = process.execPath;
    app.setLoginItemSettings(opts);
  } catch {}
}

app.whenReady().then(() => {
  syncLoginItem();
  createWindow();
  try { if (app.dock) app.dock.show(); } catch {}
  showWindow(); // open visibly on launch; hotkey / Dock click still toggle
  try { if (app.dock) app.dock.show(); } catch {}
  showWindow(); // open visibly on launch (Dock click / login item / hotkey still work)

  const icon = nativeImage.createFromPath(path.join(__dirname, "../assets/tray.png"));
  icon.setTemplateImage(true); // native menu-bar behavior (auto light/dark)
  tray = new Tray(icon);
  tray.setToolTip("Donna — your assistant");
  setInterval(updateTray, 30000); updateTray();

  const openTo = (v, mode = "full") => {
    clearAttention();
    showWindow();
    applyMode(mode);
    if (v && win) setTimeout(() => win.webContents.send("donna:goto", v), 140);
  };
  // click the menu-bar icon → a little menu of what you want to do
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Donna", accelerator: "Cmd+Shift+Space", click: () => openTo("today") },
    { label: "Open Donna (alt)", accelerator: "Cmd+Alt+D", click: () => openTo("today") },
    { label: "Ask Donna…", click: () => openTo("ask") },
    { label: "Today's focus", click: () => openTo("today") },
    { type: "separator" },
    { label: "Dock to corner", click: () => { clearAttention(); showWindow(); applyMode("compact"); } },
    { label: "Collapse to pill", click: () => { clearAttention(); showWindow(); applyMode("pill"); } },
    { type: "separator" },
    { label: "Quit Donna", click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  // ⌘⇧Space = toggle window (Spotlight may steal this on some macOS versions;
  // if it does, ⌃⌥D is the secondary binding, registered below)
  globalShortcut.register("CommandOrControl+Shift+Space", toggleWindow);
  // ⌃⌥D = alternate "open Donna" binding (Spotlight doesn't own this)
  globalShortcut.register("CommandOrControl+Alt+D", toggleWindow);
  // ⌥Space = quick capture from ANYWHERE — grabs where you were (Things Autofill)
  globalShortcut.register(config.captureHotkey || "Alt+Space", openQuickCapture);

  // Your menu bar is full so macOS hides the tray item — keep a proper Dock icon
  // as the reliable, always-visible way to open Donna (click it → she opens).
  // The tray still appears up top if the bar ever has room.
  const STATIC_ICON = nativeImage.createFromPath(path.join(__dirname, "../assets/appicon.png"));
  if (app.dock) {
    try { app.dock.setIcon(STATIC_ICON); } catch {}
  }
  /* the "moving logo" — macOS Dock icons can't animate on their own, but we
     can flip frames ourselves. A real static .icns stays the Finder/Spotlight
     identity (that one can't animate); this only breathes the Dock icon
     while she's actually thinking, so it reads as alive without being a
     gimmick running 24/7. */
  const ORB_FRAMES_DIR = path.join(__dirname, "../assets/build/orb_frames");
  let orbFrames = [];
  try { orbFrames = Array.from({ length: 8 }, (_, i) => nativeImage.createFromPath(path.join(ORB_FRAMES_DIR, `frame${i}.png`))).filter((i) => !i.isEmpty()); } catch {}
  let dockAnimT = null, dockFrameI = 0;
  function setThinking(on) {
    if (!app.dock || !orbFrames.length) return;
    if (on) {
      if (dockAnimT) return;
      dockAnimT = setInterval(() => { dockFrameI = (dockFrameI + 1) % orbFrames.length; try { app.dock.setIcon(orbFrames[dockFrameI]); } catch {} }, 90);
    } else {
      clearInterval(dockAnimT); dockAnimT = null;
      try { app.dock.setIcon(STATIC_ICON); } catch {}
    }
  }
  app.on("activate", () => showWindow()); // clicking the Dock icon reopens her

  /* ── IPC ── */
  ipcMain.handle("donna:init", () => ({ mode, config, tasks: tasks.summary(), captures: captureStore.list(), production: production.snapshot(), habits: require("./lib/habits").list(), reminders: require("./lib/reminders").list(), replacements: require("./lib/replacements").list() }));
  ipcMain.handle("donna:habitsList", () => require("./lib/habits").list());
  ipcMain.handle("donna:habitsToggle", (_e, id) => require("./lib/habits").toggle(id));
  ipcMain.handle("donna:plan", () => {
    const open = tasks.summary().open;
    let events = [], calOk = false, calReason = null;
    try { const r = require("./lib/calendar").today(); events = r.events || []; calOk = !!r.ok; calReason = r.reason || null; } catch { calReason = "nomodule"; }
    const p = require("./lib/schedule").plan(open, events, { startHour: config.dayStartHour || 9, endHour: config.dayEndHour || 19 });
    return { ...p, calOk, calReason };
  });
  ipcMain.handle("donna:getConfig", () => config);
  ipcMain.handle("donna:setConfig", (_e, patch) => {
    Object.assign(config, patch || {});
    notifyEnabled = config.notifications !== false;
    if (patch && "launchAtLogin" in patch) syncLoginItem();
    try { appConfig.save(config); } catch {}
    return config;
  });
  // is Donna running as the installed .app (vs a terminal `npm start`)?
  ipcMain.handle("donna:appInfo", () => ({ packaged: !!app.isPackaged, loginAtStart: !!config.launchAtLogin }));
  ipcMain.handle("donna:setMode", (_e, m) => { if (MODES[m]) applyMode(m); return mode; });
  ipcMain.handle("donna:orbToggle", () => { toggleOrb(); return orbWin ? orbWin.isVisible() : false; });
  ipcMain.handle("donna:orbStatus", () => ({ visible: !!(orbWin && orbWin.isVisible()) }));
  ipcMain.handle("donna:orbSetExpanded", (_e, on) => setOrbExpanded(on));
  ipcMain.handle("donna:tasks", () => tasks.summary());
  ipcMain.handle("donna:production", async () => ({ ...(await production.liveSnapshot()), agents: production.agents() }));
  ipcMain.handle("donna:completeTask", (_e, id) => tasks.complete(id));
  ipcMain.handle("donna:setStatus", (_e, { id, status }) => tasks.setStatus(id, status));
  ipcMain.handle("donna:setWaiting", (_e, { id, who }) => tasks.setWaiting(id, who));
  ipcMain.handle("donna:setDue", (_e, { id, dueAt }) => tasks.setDue(id, dueAt));
  ipcMain.handle("donna:setPriority", (_e, { id, priority }) => tasks.setPriority(id, priority));
  ipcMain.handle("donna:setTaskField", (_e, { id, field, value }) => tasks.setField(id, field, value));
  ipcMain.handle("donna:setWontDo", (_e, { id, reason }) => tasks.setWontDo(id, reason));
  ipcMain.handle("donna:addActual", (_e, { id, minutes }) => tasks.addActual(id, minutes));
  ipcMain.handle("donna:addTask", (_e, title) => tasks.add(title));
  ipcMain.handle("donna:quickAdd", (_e, { text, detail }) => {
    const id = tasks.add(text, null, detail);
    if (win) { win.webContents.send("donna:refresh"); }
    return id;
  });
  ipcMain.handle("donna:captureHide", () => { if (capWin) capWin.hide(); return true; });
  ipcMain.handle("donna:captures", () => captureStore.list());
  ipcMain.handle("donna:rhythm", () => require("./lib/sessions").stats());
  ipcMain.handle("donna:trackerToday", () => require("./lib/tracker").today());
  ipcMain.handle("donna:trackerDay", (_e, dateStr) => require("./lib/tracker").computeDay(dateStr));
  ipcMain.handle("donna:trackerHistory", (_e, n) => require("./lib/tracker").history(n || 14));
  ipcMain.handle("donna:shotThumb", (_e, p) => require("./lib/tracker").shotThumb(p));
  ipcMain.handle("donna:trackerToggle", () => { const t = require("./lib/tracker").toggle(); if (win) win.webContents.send("donna:notify", t.tracking ? "Tracking on — clocked in" : "Tracking off — clocked out"); return t; });
  ipcMain.handle("donna:trackerConfigGet", () => require("./lib/tracker").getTrackerConfig());
  ipcMain.handle("donna:trackerConfigSet", (_e, patch) => require("./lib/tracker").setTrackerConfig(patch));
  ipcMain.handle("donna:patterns", () => require("./lib/patterns"));
  ipcMain.handle("donna:aliasesList", () => require("./lib/aliases").list());
  ipcMain.handle("donna:capacity", () => require("./lib/capacity").load21Days());
  ipcMain.handle("donna:demoLoad", () => require("./lib/demo").ensureDemo());
  ipcMain.handle("donna:aliasesAdd", (_e, { key, value }) => require("./lib/aliases").add(key, value));
  ipcMain.handle("donna:aliasesRemove", (_e, key) => require("./lib/aliases").remove(key));
  ipcMain.handle("donna:aliasesResolve", (_e, q) => require("./lib/aliases").resolve(q));
  ipcMain.handle("donna:trackerPickSaveDir", async () => {
    const { dialog } = require("electron");
    const r = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return require("./lib/tracker").getTrackerConfig();
    return require("./lib/tracker").setTrackerConfig({ saveDir: r.filePaths[0] });
  });
  ipcMain.handle("donna:pickContext", async () => {
    const { dialog } = require("electron");
    const r = await dialog.showOpenDialog(win, {
      title: "What should Donna read?",
      properties: ["openFile", "openDirectory", "multiSelections"],
    });
    return r.canceled ? [] : r.filePaths;
  });
  /* the honest end-of-day recap — no commercial tracker does this well */
  ipcMain.handle("donna:dayRecap", async () => {
    try {
      const c = require("./lib/tracker").computeDay();
      if (c.activeMin < 20) return { ok: false, reason: "not enough tracked time yet" };
      const cats = c.cats.slice(0, 6).map((x) => `${x.cat} ${x.min}m`).join(", ");
      const q = `quick: In exactly 3-5 short lines, give me the honest recap of my tracked day — no flattery, no lists, just how it actually went. Data: active ${c.activeMin}m, pulse ${c.pulse}/100, deep work ${c.deepMin}m across ${c.focusCount} sessions (longest ${c.longestMin}m), ${c.switchesPerHr} app-switches/hr. Time by category: ${cats}.`;
      const res = await brain.ask(q, { onState: () => {}, onToken: () => {} });
      return { ok: true, text: (res.answer || "").trim(), stats: { activeMin: c.activeMin, pulse: c.pulse, deepMin: c.deepMin } };
    } catch (e) { return { ok: false, reason: e.message }; }
  });
  ipcMain.handle("donna:openShot", (_e, p) => { try { require("electron").shell.openPath(p); } catch {} return true; });
  ipcMain.handle("donna:waitingList", () => require("./lib/waiting").list());
  ipcMain.handle("donna:waitingAdd", (_e, { item, who }) => require("./lib/waiting").add(item, who));
  ipcMain.handle("donna:waitingResolve", (_e, id) => require("./lib/waiting").resolve(id));
  ipcMain.handle("donna:waitingRollup", () => require("./lib/waiting").rollup());
  ipcMain.handle("donna:sleepGet", () => require("./lib/sleep").get());
  ipcMain.handle("donna:briefing", async (_e, opts) => require("./lib/briefing").generate(opts || {}));
  ipcMain.handle("donna:decisionsList", () => require("./lib/decisions").list());
  ipcMain.handle("donna:decisionsAdd", (_e, payload) => require("./lib/decisions").add(payload || {}));
  ipcMain.handle("donna:decisionsRemove", (_e, id) => require("./lib/decisions").remove(id));
  ipcMain.handle("donna:antigoalsList", () => require("./lib/antigoals").list());
  ipcMain.handle("donna:antigoalsAdd", (_e, payload) => require("./lib/antigoals").add(payload || {}));
  ipcMain.handle("donna:antigoalsRemove", (_e, id) => require("./lib/antigoals").remove(id));
  ipcMain.handle("donna:backlinksFor", (_e, { kind, id }) => require("./lib/backlinks").backlinksFor(kind, id));
  ipcMain.handle("donna:backlinksResolve", (_e, text) => require("./lib/backlinks").resolveInText(text || ""));
  ipcMain.handle("donna:sleepSet", (_e, payload) => require("./lib/sleep").set(payload || {}));
  ipcMain.handle("donna:sleepAverage", () => require("./lib/sleep").average());
  ipcMain.handle("donna:diagnostic", async () => {
    let permStatus = null;
    try { permStatus = await Promise.race([ipcMain.emit ? null : null, Promise.resolve(null)]); } catch {}
    try {
      const out = { screen: "unknown" };
      try { out.screen = require("electron").systemPreferences.getMediaAccessStatus("screen"); } catch {}
      permStatus = out;
    } catch {}
    let tcfg = null;
    try { tcfg = require("./lib/tracker").getTrackerConfig(); } catch {}
    return require("./lib/diagnostic").run({ permStatus, trackerConfig: tcfg, cfg: config });
  });
  ipcMain.handle("donna:notesList", () => require("./lib/notes").list());
  ipcMain.handle("donna:notesAdd", (_e, { title, body }) => require("./lib/notes").add(title, body));
  ipcMain.handle("donna:notesUpdate", (_e, { id, patch }) => require("./lib/notes").update(id, patch));
  ipcMain.handle("donna:notesRemove", (_e, id) => require("./lib/notes").remove(id));
  ipcMain.handle("donna:notesDaily", () => require("./lib/notes").ensureDaily());
  ipcMain.handle("donna:peopleList", () => require("./lib/people").list());
  ipcMain.handle("donna:peopleUpdate", (_e, { id, patch }) => require("./lib/people").update(id, patch));
  ipcMain.handle("donna:peopleTouch", (_e, id) => require("./lib/people").touch(id));
  ipcMain.handle("donna:peopleAdd", (_e, { name, role }) => require("./lib/people").add(name, role));
  ipcMain.handle("donna:memoryList", () => require("./lib/memory").list());
  ipcMain.handle("donna:memoryAdd", (_e, { fact, kind }) => require("./lib/memory").add(fact, kind, "manual"));
  ipcMain.handle("donna:memoryUpdate", (_e, { id, patch }) => require("./lib/memory").update(id, patch));
  ipcMain.handle("donna:memoryRemove", (_e, id) => require("./lib/memory").remove(id));
  ipcMain.handle("donna:goalsList", () => require("./lib/goals").list());
  ipcMain.handle("donna:goalsAdd", (_e, { objective, why, domain }) => require("./lib/goals").add(objective, why, domain));
  ipcMain.handle("donna:goalsDomainCoverage", () => require("./lib/goals").domainCoverage());
  ipcMain.handle("donna:goalsUpdate", (_e, { id, patch }) => require("./lib/goals").update(id, patch));
  ipcMain.handle("donna:goalsRemove", (_e, id) => require("./lib/goals").remove(id));
  ipcMain.handle("donna:goalsAddKR", (_e, { id, text, target, unit }) => require("./lib/goals").addKR(id, text, target, unit));
  ipcMain.handle("donna:goalsUpdateKR", (_e, { id, krId, patch }) => require("./lib/goals").updateKR(id, krId, patch));
  ipcMain.handle("donna:goalsRemoveKR", (_e, { id, krId }) => require("./lib/goals").removeKR(id, krId));
  ipcMain.handle("donna:goalsAddMilestone", (_e, { id, text }) => require("./lib/goals").addMilestone(id, text));
  ipcMain.handle("donna:goalsToggleMilestone", (_e, { id, mId }) => require("./lib/goals").toggleMilestone(id, mId));
  ipcMain.handle("donna:goalsRemoveMilestone", (_e, { id, mId }) => require("./lib/goals").removeMilestone(id, mId));
  ipcMain.handle("donna:goalsSetWeek", (_e, { id, committed, done }) => require("./lib/goals").setWeek(id, committed, done));
  ipcMain.handle("donna:goalsTopLead", () => require("./lib/goals").topLead());
  ipcMain.handle("donna:goalsWeek", () => require("./lib/goals").aggregateWeek(require("./lib/goals").list()));
  ipcMain.handle("donna:goalsListTemplates", () => require("./lib/goals").listTemplates());
  ipcMain.handle("donna:goalsApplyTemplate", (_e, key) => require("./lib/goals").applyTemplate(key));
  ipcMain.handle("donna:activityList", (_e, opts) => require("./lib/activity").list(opts || {}));
  ipcMain.handle("donna:activityGrouped", (_e, opts) => require("./lib/activity").grouped(opts || {}));
  ipcMain.handle("donna:activityRollup", (_e, since) => require("./lib/activity").rollup(since));
  try { require("./lib/activity").backfill(); } catch {}
  /* No external dashboard wiring in the public build. */
  ipcMain.handle("donna:agency", async () => ({ up: false, overview: null, alerts: [] }));
  ipcMain.handle("donna:dashOpen", () => false);
  ipcMain.handle("donna:dashStart", () => false);
  ipcMain.handle("donna:comms", () => require("./lib/comms").status(config));
  ipcMain.handle("donna:connectGmail", async () => { try { await require("./lib/gmail").connect(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
  ipcMain.handle("donna:gmailUnread", () => require("./lib/gmail").unread());
  ipcMain.handle("donna:permStatus", () => {
    const out = { screen: "unknown", calendar: "unknown" };
    try { out.screen = require("electron").systemPreferences.getMediaAccessStatus("screen"); } catch {}
    try { out.calendar = require("./lib/calendar").today().ok ? "granted" : "not-determined"; } catch {}
    return out;
  });
  ipcMain.handle("donna:requestPerm", (_e, kind) => {
    try {
      if (kind === "screen") require("node:child_process").exec("screencapture -x /tmp/donna_perm.png >/dev/null 2>&1; rm -f /tmp/donna_perm.png");
      if (kind === "calendar") { try { require("./lib/calendar").today(); } catch {} }
      require("electron").shell.openExternal(kind === "screen"
        ? "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
        : "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars");
    } catch {}
    return true;
  });
  ipcMain.handle("donna:ideasList", () => require("./lib/ideas").list());
  ipcMain.handle("donna:ideasAdd", (_e, { text, niche }) => require("./lib/ideas").add(text, niche));
  ipcMain.handle("donna:ideasUpdate", (_e, { id, patch }) => require("./lib/ideas").update(id, patch));
  ipcMain.handle("donna:ideasRemove", (_e, id) => require("./lib/ideas").remove(id));
  ipcMain.handle("donna:searchIndex", () => {
    const out = [];
    const push = (type, title, view) => { if (title) out.push({ type, title: String(title).slice(0, 90), view }); };
    try { for (const t of tasks.summary().open) push("task", t.title, "tasks"); } catch {}
    try { for (const n of require("./lib/notes").list()) push("note", n.title, "notes"); } catch {}
    try { for (const p of require("./lib/people").list()) push("person", p.name, "people"); } catch {}
    try { for (const g of require("./lib/goals").list()) push("goal", g.title, "goals"); } catch {}
    try { for (const i of require("./lib/ideas").list()) push("idea", i.text, "ideas"); } catch {}
    try { for (const w of require("./lib/waiting").list()) push("waiting", w.item, "waiting"); } catch {}
    try { for (const c of captureStore.list()) push("capture", c.text || c.title, "capture"); } catch {}
    return out;
  });
  ipcMain.handle("donna:remindersList", () => require("./lib/reminders").list());
  ipcMain.handle("donna:remindersAdd", (_e, { text, at }) => require("./lib/reminders").add(text, at));
  ipcMain.handle("donna:remindersDone", (_e, id) => require("./lib/reminders").done(id));
  ipcMain.handle("donna:replacementsList", () => require("./lib/replacements").list());
  ipcMain.handle("donna:replacementsAdd", (_e, fields) => require("./lib/replacements").add(fields));
  ipcMain.handle("donna:replacementsUpdate", (_e, { id, patch }) => require("./lib/replacements").update(id, patch));
  ipcMain.handle("donna:replacementsRemove", (_e, id) => require("./lib/replacements").remove(id));
  ipcMain.handle("donna:replacementsToggle", (_e, id) => require("./lib/replacements").toggle(id));
  ipcMain.handle("donna:canvasGet", () => require("./lib/canvas").get());
  ipcMain.handle("donna:canvasAddBoard", (_e, name) => require("./lib/canvas").addBoard(name));
  ipcMain.handle("donna:canvasRenameBoard", (_e, { id, name }) => require("./lib/canvas").renameBoard(id, name));
  ipcMain.handle("donna:canvasRemoveBoard", (_e, id) => require("./lib/canvas").removeBoard(id));
  ipcMain.handle("donna:canvasSaveBoard", (_e, board) => require("./lib/canvas").saveBoard(board));
  ipcMain.handle("donna:visionGet", () => require("./lib/vision").get());
  ipcMain.handle("donna:visionSet", (_e, { h, a, text }) => require("./lib/vision").setVision(h, a, text));
  ipcMain.handle("donna:visionAddStep", (_e, { h, a, text }) => require("./lib/vision").addStep(h, a, text));
  ipcMain.handle("donna:visionAddSteps", (_e, { h, a, texts }) => require("./lib/vision").addSteps(h, a, texts));
  ipcMain.handle("donna:visionToggleStep", (_e, { h, a, id }) => require("./lib/vision").toggleStep(h, a, id));
  ipcMain.handle("donna:visionRemoveStep", (_e, { h, a, id }) => require("./lib/vision").removeStep(h, a, id));
  /* let the brain break a vision into concrete steps */
  ipcMain.handle("donna:visionBreakdown", async (_e, { horizon, area, vision }) => {
    try {
      const q = `think: Break this ${horizon} vision for my ${area} into 3-5 concrete, doable steps. Vision: "${vision}". Reply ONLY as short step lines, one per line, no numbering, no preamble.`;
      const res = await brain.ask(q, { onState: () => {}, onToken: () => {} });
      const steps = (res.answer || "").split("\n").map((l) => l.replace(/^[\s\-\d.)*•]+/, "").trim()).filter((l) => l.length > 2).slice(0, 6);
      return steps;
    } catch { return []; }
  });
  ipcMain.handle("donna:lifeGet", () => require("./lib/life").get());
  ipcMain.handle("donna:lifeSetScore", (_e, { domain, score, note }) => require("./lib/life").setScore(domain, score, note));
  // fire due reminders as native notifications
  setInterval(() => {
    try {
      const rem = require("./lib/reminders");
      for (const r of rem.due()) {
        if (notifyEnabled && Notification.isSupported()) new Notification({ title: "Donna · Reminder", body: r.text }).show();
        rem.markFired(r.id);
        if (win) win.webContents.send("donna:notify", "⏰ " + r.text);
      }
    } catch {}
  }, 30000);
  ipcMain.handle("donna:export", () => {
    const dir = path.join(__dirname, "../data");
    const out = { app: "Donna", exportedAt: new Date().toISOString() };
    try { for (const f of fs.readdirSync(dir)) if (f.endsWith(".json")) { try { out[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch {} } } catch {}
    const dest = path.join(process.env.HOME, "Desktop", `donna-backup-${new Date().toISOString().slice(0, 10)}.json`);
    try { fs.writeFileSync(dest, JSON.stringify(out, null, 2)); require("electron").shell.showItemInFolder(dest); } catch {}
    return dest;
  });
  ipcMain.handle("donna:exportMarkdown", (_e, surface) => {
    const fn = require("./lib/export")[surface] || require("./lib/export").all;
    const md = fn();
    const dest = path.join(process.env.HOME, "Desktop", `donna-${surface}-${new Date().toISOString().slice(0, 10)}.md`);
    try { fs.writeFileSync(dest, md); require("electron").shell.showItemInFolder(dest); } catch {}
    return { dest, content: md };
  });
  ipcMain.handle("donna:exportMarkdownCopy", (_e, surface) => {
    const fn = require("./lib/export")[surface] || require("./lib/export").all;
    return fn();
  });
  ipcMain.handle("donna:reflect", (_e, text) => {
    const f = path.join(__dirname, "../data/journal.json");
    let j = []; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
    j.push({ at: new Date().toISOString(), text: String(text || "").slice(0, 500) });
    try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(j)); } catch {}
    return true;
  });
  ipcMain.handle("donna:hide", () => hideWindow());
  ipcMain.handle("donna:ask", async (_e, text) => {
    const send = (ch, v) => { try { _e.sender.send(ch, v); } catch {} };
    const res = await brain.ask(text, {
      onState: (s) => { send("donna:state", s); setThinking(s === "thinking"); },
      onToken: (t) => send("donna:token", t),
    });
    setThinking(false);
    if (voice && res.answer) { send("donna:state", "speaking"); voice.speak(res.answer); }
    extractFacts(text).catch(() => {}); // ambient memory — never blocks the answer
    return res;
  });
  /* internal asks (morning brief, recaps) — Donna prompting herself. Same
     brain, but NEVER mined for memory: her own instructions aren't facts
     about Alex (the miner once learned "wants no preamble" from a brief). */
  ipcMain.handle("donna:askInternal", async (_e, text) => {
    const send = (ch, v) => win && win.webContents.send(ch, v);
    const res = await brain.ask(text, { onState: (s) => { send("donna:state", s); setThinking(s === "thinking"); }, onToken: () => {} });
    setThinking(false);
    return res;
  });
  /* ambient fact mining (Dot's green flash) — cheap M3 pass over what ALEX
     said (never Donna's answer — no hallucinated selves), fire-and-forget */
  async function extractFacts(userText) {
    const t = String(userText || "");
    if (t.length < 25) return;
    const memory = require("./lib/memory");
    const q = `Extract lasting personal facts about Alex from this message he wrote — preferences, people in his life, dates that matter, health, ongoing projects. Verbatim-grounded only, no inference. Reply with ONLY a JSON array like [{"fact":"…","kind":"preference"}] (kinds: person|preference|date|project|health|fact). Empty array if none.\n\nMessage: "${t.slice(0, 600)}"`;
    try {
      const raw = await clients.m3(q, "You extract facts. JSON only, no prose.");
      const m = raw.match(/\[[\s\S]*\]/);
      if (!m) return;
      const facts = JSON.parse(m[0]).slice(0, 3);
      let n = 0;
      for (const f of facts) if (f && f.fact && memory.add(f.fact, f.kind, "chat")) n++;
      if (n && win) win.webContents.send("donna:remembered", n);
    } catch {}
  }

  /* auto-track: the whole point is zero-effort self-memory — start on boot
     unless Alex turned it off. Nudges route through the same notification
     gate as everything else. */
  const tracker = require("./lib/tracker");
  /* nudge budget — the Dot lesson: one weak nudge teaches you to ignore ALL
     nudges. Hard cap of 3 tracker nudges a day, whatever the triggers say. */
  let nudgeDay = "", nudgeCount = 0;
  tracker.setNudge((n) => {
    if (!notifyEnabled) return;
    const d = new Date().toISOString().slice(0, 10);
    if (d !== nudgeDay) { nudgeDay = d; nudgeCount = 0; }
    if (nudgeCount >= 3) return;
    nudgeCount++;
    try { if (Notification.isSupported()) new Notification({ title: `Donna · ${n.title}`, body: n.body }).show(); } catch {}
    if (win) win.webContents.send("donna:notify", `${n.title} — ${n.body}`);
  });
  if (config.autoTrack !== false) tracker.start();

  /* wake word — "Donna, ..." dictated through FluidVoice, hands-free. Pops
     the orb out expanded (if not already) so the answer has somewhere to
     land, speaks it back if voice replies are on. */
  if (config.wakeWord !== false) {
    require("./lib/wakeword").start(async (query) => {
      if (!query) return;
      showOrb();
      if (!orbWin) return;
      setOrbExpanded(true);
      orbWin.webContents.send("donna:wake", query);
      const send = (ch, v) => { try { orbWin.webContents.send(ch, v); } catch {} };
      const res = await brain.ask(query, { onState: (s) => send("donna:state", s), onToken: (t) => send("donna:token", t) });
      if (voice && res.answer) { send("donna:state", "speaking"); voice.speak(res.answer); }
    });
  }

  // Always-synced watchers → native notification + tray badge + live renderer refresh
  createWatchers({
    onEvent: (e) => {
      if (notifyEnabled) {
        attention += 1;
        try { if (Notification.isSupported()) new Notification({ title: `Donna · ${e.title}`, body: e.body, silent: !e.alert }).show(); } catch {}
        if (tray && !(win && win.isVisible())) updateTray();
      }
      if (win) {
        win.webContents.send("donna:notify", `${e.title} — ${e.body}`);
        win.webContents.send("donna:refresh");
      }
    },
  });

  showWindow().then(() => {
    const wa = cursorWorkArea();
    win.setBounds({ x: wa.x + Math.round((wa.width - MODES.full.w) / 2), y: wa.y + Math.round((wa.height - MODES.full.h) / 2), width: MODES.full.w, height: MODES.full.h });
    const startMode = process.env.DONNA_START_MODE;
    if (startMode && MODES[startMode]) setTimeout(() => applyMode(startMode), 300);
    if (process.env.DONNA_TEST_CAPTURE) setTimeout(openQuickCapture, 500); // dev QA hook
    if (process.env.DONNA_SHOT) setTimeout(async () => {  // dev QA hook: self-screenshot → quit
      try {
        if (process.env.DONNA_SHOT_JS) { await win.webContents.executeJavaScript(process.env.DONNA_SHOT_JS); await new Promise((r) => setTimeout(r, 900)); }
        const img = await win.webContents.capturePage();
        fs.writeFileSync(process.env.DONNA_SHOT, img.toPNG());
      } catch (e) { console.log("[probe-err]", e.message); }
      app.isQuitting = true; app.quit();
    }, Number(process.env.DONNA_SHOT_DELAY || 2500));

  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {}); // stays alive in the menu bar
