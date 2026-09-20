
let __tcfg = null;
let settingsTab = localStorage.getItem("donna.settingsTab") || "general";
const SETTINGS_TABS = [["general", "General"], ["focus", "Focus"], ["tracker", "Tracker"], ["permissions", "Permissions"], ["data", "Data"], ["sections", "Sections"], ["shortcuts", "Shortcuts"]];
async function vSettings() {
  const toggle = (key, on) => `<button class="switch ${on ? "on" : ""}" data-toggle="${key}"><span class="knob"></span></button>`;
  const roots = (cfg.contextRoots || []).map((r) => String(r).replace(/^\/Users\/[^/]+/, "~").replace(/^\/home\/[^/]+/, "~"));
  __tcfg = await window.donna.trackerConfigGet();
  const dirLabel = __tcfg.saveDir ? "…/" + __tcfg.saveDir.split("/").slice(-2).join("/") : "default (app data)";
  const pane = (key, html) => `<div class="set-pane" data-pane="${key}"${settingsTab === key ? "" : " hidden"}>${html}</div>`;
  main.innerHTML = `<div class="view">
    <div class="lib-head">
      <div><h1 class="h1">Settings</h1><p class="sub">Tuned for you<span class="sep">·</span>Donna v${window.__ver || "1"}</p></div>
      <div class="seg vz-seg set-tabseg">${SETTINGS_TABS.map(([k, l]) => `<button data-settab="${k}" class="${settingsTab === k ? "on" : ""}">${l}</button>`).join("")}</div>
    </div>

    ${pane("general", `
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Your name</div><div class="set-hint">How Donna addresses you</div></div><input id="set-name" class="set-input" value="${esc(cfg.userName || "")}" placeholder="e.g. Sam"></div>
      <div class="set-row"><div><div class="set-label">AI provider</div><div class="set-hint">Bring your own key — stored locally on this Mac</div></div>
        <select id="set-provider" class="set-input">
          <option value="anthropic"${cfg.provider === "anthropic" ? " selected" : ""}>Anthropic (Claude)</option>
          <option value="openai"${cfg.provider === "openai" ? " selected" : ""}>OpenAI</option>
          <option value="minimax"${cfg.provider === "minimax" ? " selected" : ""}>MiniMax</option>
          <option value="claude-cli"${cfg.provider === "claude-cli" ? " selected" : ""}>Claude CLI (local)</option>
        </select></div>
      <div class="set-row"><div><div class="set-label">API key</div><div class="set-hint">Or set ANTHROPIC_API_KEY / OPENAI_API_KEY in your environment</div></div><input id="set-key" class="set-input" type="password" value="${esc(cfg.apiKey || "")}" placeholder="sk-…"></div>
      <div class="set-row"><div></div><button class="wind-btn" id="set-ai-save" style="width:auto;margin:0;padding:8px 14px">Save</button></div>
      <div class="set-row"><div><div class="set-label">Notifications</div><div class="set-hint">Native alerts when things change</div></div>${toggle("notifications", cfg.notifications !== false)}</div>
      <div class="set-row"><div><div class="set-label">Voice replies</div><div class="set-hint">Speak answers aloud (needs a local voice setup)</div></div>${toggle("voice", !!cfg.voice)}</div>
      <div class="set-row"><div><div class="set-label">Wake word</div><div class="set-hint">Say "Donna, …" in any FluidVoice dictation to ask hands-free · restart to apply</div></div>${toggle("wakeWord", cfg.wakeWord !== false)}</div>
      <div class="set-row"><div><div class="set-label">Sounds</div><div class="set-hint">Tiny synthesized cues on complete · habit · capture</div></div>${toggle("sounds", cfg.sounds !== false)}</div>
      <div class="set-row"><div><div class="set-label">Auto-track</div><div class="set-hint">Watch app/window activity from boot — all local, prunes after 14 days · restart to apply</div></div>${toggle("autoTrack", cfg.autoTrack !== false)}</div>
      <div class="set-row"><div><div class="set-label">Launch at login</div><div class="set-hint">Open Donna automatically when you start your Mac</div></div>${toggle("launchAtLogin", !!cfg.launchAtLogin)}</div>
    </div>
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Onboarding tour</div><div class="set-hint">Replay the 5-step tour. Clears the onboarded flag.</div></div>
        <button class="wind-btn" id="btn-reonboard" style="width:auto;margin:0;padding:8px 14px">Replay tour</button></div>
    </div>
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Saved aliases</div><div class="set-hint">Your command shortcuts. "wk" → "filter tasks to #week" etc. Surfaces in ⌘K.</div></div></div>
      <div class="quick-add" style="display:flex;gap:8px;margin-top:6px">
        <input id="al-key" style="flex:1" placeholder="key (e.g. wc)">
        <input id="al-val" style="flex:2" placeholder='value (e.g. "filter tasks to #week")'>
        <button class="hero-btn go" id="al-add">Add</button>
      </div>
      <div id="al-list" style="margin-top:10px"></div>
    </div>`)}

    ${pane("focus", `
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Daily capacity</div><div class="set-hint">Hours of focus before the meter warns you're over-planned</div></div>
        <div class="stepper"><button data-cap="-">−</button><span id="cap-val">${cfg.capacityHours || 6}h</span><button data-cap="+">+</button></div></div>
      <div class="set-row"><div><div class="set-label">Working hours</div><div class="set-hint">The window Plan schedules your day into</div></div>
        <div class="stepper"><button data-wh="s-">−</button><span id="wh-s">${cfg.dayStartHour || 9}</span><span class="stepper-arrow">→</span><span id="wh-e">${cfg.dayEndHour || 19}</span><button data-wh="e+">+</button></div></div>
    </div>`)}

    ${pane("tracker", `
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Screenshots</div><div class="set-hint">Capture periodic evidence shots while tracking</div></div>${toggle("tcShots", __tcfg.shotsEnabled !== false)}</div>
      <div class="set-row"><div><div class="set-label">Screenshot cadence</div><div class="set-hint">How often, in minutes</div></div>
        <div class="stepper"><button data-tccad="-">−</button><span id="tc-cad-val">${__tcfg.shotIntervalMin}m</span><button data-tccad="+">+</button></div></div>
      <div class="set-row"><div><div class="set-label">Keep for</div><div class="set-hint">Screenshots older than this are auto-deleted</div></div>
        <div class="stepper"><button data-tckeep="-">−</button><span id="tc-keep-val">${__tcfg.keepDays}d</span><button data-tckeep="+">+</button></div></div>
      <div class="set-row"><div><div class="set-label">Save location</div><div class="set-hint mono" id="tc-dir">${esc(dirLabel)}</div></div>
        <button class="wind-btn" id="tc-pickdir" style="width:auto;margin:0;padding:8px 14px">Choose…</button></div>
    </div>`)}

    ${pane("permissions", `
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Screen Recording</div><div class="set-hint" id="perm-screen">Lets the Tracker capture screenshots</div></div>
        <button class="wind-btn" data-perm="screen" style="width:auto;margin:0;padding:8px 14px">Grant</button></div>
      <div class="set-row"><div><div class="set-label">Calendar</div><div class="set-hint" id="perm-cal">Lets Plan fold your events into the day</div></div>
        <button class="wind-btn" data-perm="calendar" style="width:auto;margin:0;padding:8px 14px">Grant</button></div>
    </div>`)}

    ${pane("data", `
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Friday briefing</div><div class="set-hint">On-demand weekly recap — AI-written, executive voice, saved as a Note</div></div>
        <button class="wind-btn" id="btn-brief" style="width:auto;margin:0;padding:8px 14px">Generate now</button></div>
      <div class="set-row"><div><div class="set-label">Demo data</div><div class="set-hint">Pre-populate tasks, goals, notes, capture, waiting with realistic example data — for trying Donna out</div></div>
        <button class="wind-btn" id="btn-demo" style="width:auto;margin:0;padding:8px 14px">Load demo</button></div>
      <div class="set-row"><div><div class="set-label">Export a backup</div><div class="set-hint">Everything (tasks, notes, people, goals, tracker…) to a JSON on your Desktop</div></div>
        <button class="wind-btn" id="btn-export" style="width:auto;margin:0;padding:8px 14px">Export</button></div>
    </div>
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Updates</div><div class="set-hint">Check for a newer version of Donna</div></div>
        <button class="wind-btn" id="btn-update" style="width:auto;margin:0;padding:8px 14px">Check for updates</button></div>
    </div>
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Markdown export</div><div class="set-hint">One .md per surface — copy or save to Desktop. Beautiful human-readable.</div></div></div>
      <div class="md-export-grid">
        ${["goals", "activity", "waiting", "log", "notes", "all"].map((s) => `<div class="md-export-cell">
          <div class="md-export-l">${esc(s)}</div>
          <button class="wind-btn md-save" data-md-save="${s}" style="width:auto;margin:0;padding:5px 10px;font-size:11px">Save .md</button>
          <button class="wind-btn md-copy" data-md-copy="${s}" style="width:auto;margin:0;padding:5px 10px;font-size:11px">Copy</button>
        </div>`).join("")}
      </div>
    </div>
    <div class="sec">What Donna reads</div>
    <div class="set-group set-static">
      ${roots.length ? roots.map((r) => `<div class="set-row src"><span class="mono">${esc(r)}</span></div>`).join("") : `<div class="set-row src"><span class="mono">No files or folders added yet</span></div>`}
    </div>
    <p class="hint" style="margin-top:14px">All of your data stays on this Mac, in <span class="mono">~/Library/Application Support/Donna</span>.</p>`)}

    ${pane("sections", `
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Pages</div><div class="set-hint">Hide any page from the sidebar. ⌘1–9 still works if you know the slot.</div></div></div>
      <div class="sec-toggles" id="sec-toggles-nav">${window.sections.all("nav").map((s) => sectionRowHtml(s)).join("")}</div>
    </div>
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Today strips</div><div class="set-hint">Each strip on the Today page is independently toggleable.</div></div></div>
      <div class="sec-toggles" id="sec-toggles-today">${window.sections.all("Today").map((s) => sectionRowHtml(s)).join("")}</div>
    </div>
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">Compact + Pill</div><div class="set-hint">The docked corner panel and the menu-bar chip. Each card is its own toggle.</div></div></div>
      <div class="sec-toggles" id="sec-toggles-compact">${window.sections.all("Compact").map((s) => sectionRowHtml(s)).join("")}</div>
    </div>
    <div class="set-group">
      <div class="set-row"><div><div class="set-label">AI</div><div class="set-hint">The contextual ✦ coach that floats on every page.</div></div></div>
      <div class="sec-toggles" id="sec-toggles-ai">${window.sections.all("ai").map((s) => sectionRowHtml(s)).join("")}</div>
    </div>
    <p class="hint" style="margin-top:14px">All on by default. Toggle off what you don't use. Settings are saved instantly to this Mac only.</p>
    <div class="set-row" style="margin-top:14px"><div><div class="set-label">Reset to defaults</div><div class="set-hint">Turn every section back on. Useful if you hid too much.</div></div>
      <button class="wind-btn" id="sec-reset-all" style="width:auto;margin:0;padding:8px 14px">Reset all</button></div>
    `)}

    ${pane("shortcuts", `
    <div class="set-group set-static">
      <div class="set-row"><span class="set-label">Summon Donna</span><kbd>⌘⇧Space</kbd></div>
      <div class="set-row"><span class="set-label">Quick capture anywhere</span><kbd>⌥Space</kbd></div>
      <div class="set-row"><span class="set-label">Command palette</span><kbd>⌘K</kbd></div>
      <div class="set-row"><span class="set-label">Switch views</span><kbd>⌘1–9</kbd></div>
      <div class="set-row"><span class="set-label">Quick add</span><kbd>⌘N</kbd></div>
      <div class="set-row"><span class="set-label">In a list</span><span class="set-hint">J/K move · Space done · D focus · S snooze · W waiting · V evening · O someday · X won't do · 1/2/3 priority</span></div>
    </div>`)}
  </div>`;

  main.querySelector(".set-tabseg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    settingsTab = b.dataset.settab; localStorage.setItem("donna.settingsTab", settingsTab); vSettings();
  });
  main.querySelectorAll("[data-toggle]").forEach((el) => (el.onclick = async () => {
    const key = el.dataset.toggle; const now = !el.classList.contains("on");
    el.classList.toggle("on", now);
    cfg = await window.donna.setConfig({ [key]: now });
    const tt = { notifications: ["Notifications on", "Notifications off"], voice: ["Voice on — restart to apply", "Voice off"], sounds: ["Sounds on", "Sounds off"], autoTrack: ["Auto-track on — restart to apply", "Auto-track off — restart to apply"], launchAtLogin: ["Donna opens at login", "Won't open at login"], wakeWord: ["Wake word on — restart to apply", "Wake word off — restart to apply"] };
    toast((tt[key] || ["On", "Off"])[now ? 0 : 1]);
    if (key === "sounds" && now) { try { snd.tick(); } catch {} }
  }));
  main.querySelectorAll("[data-cap]").forEach((el) => (el.onclick = async () => {
    let h = cfg.capacityHours || 6; h = Math.max(1, Math.min(16, h + (el.dataset.cap === "+" ? 1 : -1)));
    cfg = await window.donna.setConfig({ capacityHours: h });
    $("#cap-val").textContent = `${h}h`;
  }));
  main.querySelectorAll("[data-wh]").forEach((el) => (el.onclick = async () => {
    let s = cfg.dayStartHour || 9, e = cfg.dayEndHour || 19;
    if (el.dataset.wh === "s-") s = Math.max(4, s - 1);
    if (el.dataset.wh === "e+") e = Math.min(23, e + 1);
    if (e - s < 4) return;
    cfg = await window.donna.setConfig({ dayStartHour: s, dayEndHour: e });
    $("#wh-s").textContent = s; $("#wh-e").textContent = e;
  }));
  const ex = $("#btn-export"); if (ex) ex.onclick = async () => { await window.donna.exportData(); toast("Backup saved to Desktop"); };
  const up = $("#btn-update");
  if (up) up.onclick = async () => {
    up.disabled = true; up.textContent = "Checking…";
    const reset = () => { up.disabled = false; up.textContent = "Check for updates"; };
    try {
      const r = await window.donna.checkUpdate();
      if (r && r.newer) {
        up.textContent = "Updating…";
        toast(`Downloading Donna ${r.latest}…`);
        const res = await window.donna.update();
        if (!res || !res.ok) {
          toast("Couldn't auto-update — opening downloads");
          window.donna.openExternal(r.url);
          reset();
        }
        // On success Donna quits and relaunches on the new version.
      } else if (r && r.current) {
        toast(`You're on the latest (v${r.current})`);
        reset();
      } else {
        toast("Couldn't reach GitHub");
        reset();
      }
    } catch {
      toast("Couldn't check for updates");
      reset();
    }
  };
  const re = $("#btn-reonboard"); if (re) re.onclick = async () => { cfg = await window.donna.setConfig({ onboarded: false }); toast("Tour will replay next launch"); };
  const aiSave = $("#set-ai-save");
  if (aiSave) aiSave.onclick = async () => {
    cfg = await window.donna.setConfig({
      userName: ($("#set-name") && $("#set-name").value.trim()) || "",
      provider: ($("#set-provider") && $("#set-provider").value) || "anthropic",
      apiKey: ($("#set-key") && $("#set-key").value.trim()) || "",
      onboarded: true,
    });
    toast("Saved — restart Donna to apply");
  };
  const br = $("#btn-brief"); if (br) br.onclick = () => { try { openBriefingModal(); } catch (e) { toast("Could not open briefing"); } };
  const dm = $("#btn-demo"); if (dm) dm.onclick = async () => { try { const n = await window.donna.demoLoad(); toast(`Demo loaded — ${n} items added`); } catch (e) { toast("Demo failed: " + e.message); } };
  main.querySelectorAll("[data-md-save]").forEach((b) => (b.onclick = async () => {
    const s = b.dataset.mdSave;
    const r = await window.donna.exportMarkdown(s);
    if (r && r.dest) toast(`Saved to ${r.dest.split("/").pop()}`);
  }));
  main.querySelectorAll("[data-md-copy]").forEach((b) => (b.onclick = async () => {
    const s = b.dataset.mdCopy;
    const md = await window.donna.exportMarkdownCopy(s);
    try { await navigator.clipboard.writeText(md); toast(`${s} markdown copied`); } catch { toast("Copy failed"); }
  }));
  main.querySelectorAll("[data-toggle=tcShots]").forEach((el) => (el.onclick = async () => {
    const now = !el.classList.contains("on"); el.classList.toggle("on", now);
    __tcfg = await window.donna.trackerConfigSet({ shotsEnabled: now });
    toast(now ? "Screenshots on" : "Screenshots off");
  }));
  main.querySelectorAll("[data-tccad]").forEach((el) => (el.onclick = async () => {
    let m = Math.max(1, Math.min(60, __tcfg.shotIntervalMin + (el.dataset.tccad === "+" ? 1 : -1)));
    __tcfg = await window.donna.trackerConfigSet({ shotIntervalMin: m });
    $("#tc-cad-val").textContent = `${m}m`;
  }));
  main.querySelectorAll("[data-tckeep]").forEach((el) => (el.onclick = async () => {
    let d = Math.max(1, Math.min(90, __tcfg.keepDays + (el.dataset.tckeep === "+" ? 1 : -1)));
    __tcfg = await window.donna.trackerConfigSet({ keepDays: d });
    $("#tc-keep-val").textContent = `${d}d`;
  }));
  const pd = $("#tc-pickdir"); if (pd) pd.onclick = async () => {
    __tcfg = await window.donna.trackerPickSaveDir();
    const dirLabel = __tcfg.saveDir ? "…/" + __tcfg.saveDir.split("/").slice(-2).join("/") : "default (app data)";
    const el = $("#tc-dir"); if (el) el.textContent = dirLabel;
    toast("Save location updated");
  };
  main.querySelectorAll("[data-perm]").forEach((el) => (el.onclick = async () => { await window.donna.requestPerm(el.dataset.perm); toast("Opening System Settings — toggle Electron on"); }));
  /* Sections tab — one toggle per page + per strip. Live: flips update the
     sidebar + every view instantly. */
  const re2 = $("#sec-reset-all"); if (re2) re2.onclick = () => {
    try { localStorage.removeItem("donna.sections"); } catch {}
    try { window.donna.sections.SECTIONS.forEach((s) => window.sonna?.setOn?.(s.id, true) || window.sections.setOn(s.id, true)); } catch {}
    toast("All sections back on");
    vSettings();
  };
  main.querySelectorAll("[data-sectoggle]").forEach((el) => (el.onclick = () => {
    const id = el.dataset.sectoggle;
    const now = window.sections.toggle(id);
    el.classList.toggle("on", now);
    const onSpan = el.querySelector(".sec-on");
    if (onSpan) onSpan.textContent = now ? "on" : "off";
    toast(now ? `${el.dataset.label} on` : `${el.dataset.label} hidden`);
  }));
  /* saved aliases — render the list + wire the add/remove */
  const al = $("#al-list");
  if (al) {
    const draw = () => {
      const map = JSON.parse(localStorage.getItem("donna.aliases") || "{}");
      const keys = Object.keys(map);
      al.innerHTML = keys.length ? keys.map((k) => `<div class="al-row"><span class="al-key">${esc(k)}</span><span class="al-arrow">→</span><span class="al-val">${esc(map[k])}</span><button class="ag-x" data-al-rm="${esc(k)}">✕</button></div>`).join("") : `<div class="hint" style="margin:0">No aliases yet. Try: <code>wk</code> → <code>filter tasks to #week</code></div>`;
      al.querySelectorAll("[data-al-rm]").forEach((b) => (b.onclick = () => {
        const k = b.dataset.alRm;
        const m = JSON.parse(localStorage.getItem("donna.aliases") || "{}");
        delete m[k];
        localStorage.setItem("donna.aliases", JSON.stringify(m));
        window.donna.aliasesRemove(k);
        draw();
        toast(`Alias "${k}" removed`);
      }));
    };
    draw();
    const addBtn = $("#al-add");
    if (addBtn) addBtn.onclick = async () => {
      const k = $("#al-key").value.trim().toLowerCase();
      const v = $("#al-val").value.trim();
      if (!k || !v) return;
      const m = JSON.parse(localStorage.getItem("donna.aliases") || "{}");
      m[k] = v;
      localStorage.setItem("donna.aliases", JSON.stringify(m));
      await window.donna.aliasesAdd(k, v);
      $("#al-key").value = ""; $("#al-val").value = "";
      draw();
      toast(`Alias "${k}" saved`);
    };
  }
  window.donna.permStatus().then((p) => {
    const s = $("#perm-screen"), c = $("#perm-cal");
    if (s && p.screen === "granted") s.textContent = "Granted ✓ — Tracker can capture";
    if (c && p.calendar === "granted") c.textContent = "Granted ✓ — Plan folds in your events";
    main.querySelectorAll("[data-perm]").forEach((b) => { const k = b.dataset.perm; if ((k === "screen" && p.screen === "granted") || (k === "calendar" && p.calendar === "granted")) { b.textContent = "Granted"; b.style.opacity = "0.5"; } });
  });
  openCoachButton("settings", { tab: settingsTab, hiddenSections: Object.keys(JSON.parse(localStorage.getItem("donna.sections") || "{}")).filter((k) => JSON.parse(localStorage.getItem("donna.sections") || "{}")[k] === false).length });
}

const fmtMin = (m) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}`;

function sectionRowHtml(s) {
  const on = window.sections.isOn(s.id);
  return `<div class="sec-row">
    <div class="sec-row-text"><div class="sec-row-l">${esc(s.label)}</div><div class="sec-row-d">${esc(s.desc || "")}</div></div>
    <button class="sec-toggle ${on ? "on" : ""}" data-sectoggle="${esc(s.id)}" data-label="${esc(s.label)}"><span class="knob"></span><span class="sec-on">${on ? "on" : "off"}</span></button>
  </div>`;
}

/* Focus-session block — folded under the auto-tracker as deep-work detail. */
function focusRhythmBlock(r) {
  if (r.total === 0) return `<div class="rows"><div class="empty">No focus sessions yet — hit <b>▸ Start focus</b> on a task to log intentional deep-work blocks alongside raw tracked time.</div></div>`;
  const maxW = Math.max(60, ...r.week.map((d) => d.minutes));
  return `<div class="fr-line"><b>${fmtMin(r.todayMin)}</b> focused today${r.streak ? ` · ${r.streak}-day streak` : ""}${r.bestTime ? ` · peak ${r.bestTime}` : ""}${r.longest ? ` · deepest ${fmtMin(r.longest.minutes)}` : ""}</div>
    <div class="rh-chart" style="height:98px">
      ${r.week.map((d, i) => `<div class="rh-col ${i === 6 ? "today" : ""}"><div class="rh-bar-wrap"><div class="rh-bar" style="height:${d.minutes ? Math.max(4, Math.round(d.minutes / maxW * 100)) : 0}%"></div></div><div class="rh-day">${d.day}</div></div>`).join("")}
    </div>`;
}

/* THE Tracker — what did I actually do today. Day timeline (colored by
   category, gaps = away) with a click-through evidence drawer, the Pulse
   dial, deep-work stats, category/app breakdowns, screenshots as memory.
   All local. Self-memory, never surveillance. */
let tkTab = localStorage.getItem("donna.tkTab") || "overview";
const TK_TABS = [["overview", "Overview"], ["breakdown", "Breakdown"], ["shots", "Screenshots"], ["focus", "Focus"]];
async function vRhythm() {
  const [r, tk, hist] = await Promise.all([window.donna.rhythm(), window.donna.trackerDay(), window.donna.trackerHistory(14)]);
  stagger = 0;
  const fmtT = (s) => new Date(s * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  /* timeline geometry: from first activity (or 7am) to now, as % of span */
  const nowS = Math.floor(Date.now() / 1000);
  const dayStart = new Date(); dayStart.setHours(cfg.dayStartHour || 7, 0, 0, 0);
  const t0 = Math.min(tk.timeline.length ? tk.timeline[0].s : nowS, Math.floor(dayStart.getTime() / 1000));
  const span = Math.max(3600, nowS - t0);
  const pct = (s) => Math.max(0, Math.min(100, ((s - t0) / span) * 100));
  const hourMarks = [];
  for (let s = Math.ceil(t0 / 3600) * 3600; s < nowS; s += 3600) hourMarks.push(s);
  const catMax = tk.cats.length ? tk.cats[0].s : 1;
  const histMax = Math.max(1, ...hist.map((h) => h.activeMin));
  const pane = (key, html) => `<div class="set-pane" data-pane="${key}"${tkTab === key ? "" : " hidden"}>${html}</div>`;
  main.innerHTML = `<div class="view wide">
    <div class="lib-head">
      <div><h1 class="h1">Tracker</h1>
      <p class="sub">${tk.tracking ? `<span class="tk-dot"></span> watching quietly` : "paused"}<span class="sep">·</span>100% local, nothing leaves this Mac</p></div>
      <div style="display:flex;gap:8px;align-items:center">
        <div class="seg vz-seg">${TK_TABS.map(([k, l]) => `<button data-tktab="${k}" class="${tkTab === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <button class="tk-clock ${tk.tracking ? "on" : ""}" id="tk-toggle">${tk.tracking ? "❚❚ Pause" : "● Resume"}</button>
      </div>
    </div>
    ${tk.appOnly ? `<div class="prod-status" style="margin-top:10px"><span class="ps warn">⚠ app-only mode — grant <b>Screen Recording</b> for window titles & URLs</span><button class="wind-btn" data-perm="screen" style="width:auto;margin:0 0 0 8px;padding:4px 10px">Grant</button></div>` : ""}

    ${pane("overview", `
    <div class="tk-board"${si()}>
      <div class="tk-cell hero"><div class="tk-ring big" style="--pct:${tk.pulse}"><span>${tk.pulse}</span></div>
        <div class="tk-cell-l">Pulse<span>time-weighted focus score</span></div></div>
      <div class="tk-cell"><b>${fmtMin(tk.activeMin)}</b><span>active</span></div>
      <div class="tk-cell"><b>${fmtMin(tk.deepMin)}</b><span>deep work</span></div>
      <div class="tk-cell"><b>${tk.longestMin ? fmtMin(tk.longestMin) : "—"}</b><span>longest block</span></div>
      <div class="tk-cell"><b>${tk.switchesPerHr}</b><span>switches/hr</span></div>
      <div class="tk-cell"><b>${tk.voiceToday || 0}</b><span>voice notes</span></div>
    </div>
    <div class="sec">Your day <span class="rh-avg">${fmtT(t0)} → now · click a block for evidence</span></div>
    <div class="tk-strip" id="tk-strip">
      ${hourMarks.map((s) => `<span class="tk-hmark" style="left:${pct(s)}%"><i>${new Date(s * 1000).getHours()}</i></span>`).join("")}
      ${tk.timeline.map((e, i) => `<button class="tk-blk" data-blk="${i}" style="left:${pct(e.s)}%;width:${Math.max(0.35, ((e.d) / span) * 100)}%;--h:${e.hue}" title="${esc(e.app)}"></button>`).join("")}
    </div>
    <div class="tk-drawer" id="tk-drawer" hidden></div>
    <div class="tk-spark">${hist.map((h, i) => `<div class="tk-spark-col ${i === hist.length - 1 ? "today" : ""}" title="${h.date} · pulse ${h.pulse} · ${fmtMin(h.activeMin)}"><div style="height:${Math.max(3, (h.activeMin / histMax) * 100)}%;opacity:${0.35 + (h.pulse / 100) * 0.65}"></div></div>`).join("")}<span class="tk-spark-l">14 days</span></div>
    `)}

    ${pane("breakdown", `
    ${tk.cats.length ? `<div class="sec">Where the time went</div>
      <div class="tk-cats">${tk.cats.map((c) => `<div class="tk-cat"${si()}>
        <span class="tk-cat-dot" style="--h:${c.hue}"></span>
        <span class="tk-cat-n">${esc(c.cat)}</span>
        <div class="tk-cat-bar"><div style="width:${Math.max(2, (c.s / catMax) * 100)}%;--h:${c.hue}"></div></div>
        <span class="tk-cat-m">${fmtMin(c.min)}</span></div>`).join("")}</div>` : `<div class="rows" style="margin-top:12px"><div class="empty">Nothing tracked yet today — Donna starts watching the moment she boots. Work a while, come back.</div></div>`}
    ${tk.apps.length ? `<div class="sec">Top apps</div>
      <table class="qtable">${tk.apps.map((a) => `<tr><td>${esc(a.app)}</td><td style="text-align:right;font-family:var(--mono);color:var(--signal)">${fmtMin(a.min)}</td></tr>`).join("")}</table>` : ""}
    `)}

    ${pane("shots", `
    <div class="sec">Screenshots <span class="rh-avg">${tk.shots.length ? `${tk.shots.length} today · kept ${__tcfg ? __tcfg.keepDays : 14} days` : "kept " + (__tcfg ? __tcfg.keepDays : 14) + " days"}</span></div>
    ${tk.shots.length ? `<div class="tk-shots" id="tk-shots">${tk.shots.slice(-12).reverse().map((s) => `<button class="tk-shot" data-full="${esc(s.full)}" data-thumb="${esc(s.thumb)}"><span class="tk-shot-t">${fmtT(s.t)}</span></button>`).join("")}</div>`
      : `<div class="rows"><div class="empty">First screenshot lands soon after boot. Blank shots → grant <b>Electron</b> Screen Recording.</div></div>`}
    `)}

    ${pane("focus", `
    <div class="sec">Focus sessions <span class="rh-avg">intentional deep work</span></div>
    ${focusRhythmBlock(r)}
    <button class="wind-btn" id="tk-weekrev" style="margin-top:20px">↻ Weekly review — zoom out on the week</button>

    <div class="sec" style="margin-top:24px">Patterns <span class="rh-avg">from 60 days of focus</span></div>
    <div id="pat-slot"></div>
    `)}
  </div>`;
  main.querySelector(".vz-seg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; tkTab = b.dataset.tktab; localStorage.setItem("donna.tkTab", tkTab); vRhythm(); });
  $("#tk-toggle").onclick = async () => { await window.donna.trackerToggle(); if (view === "rhythm") vRhythm(); };
  const wr = $("#tk-weekrev"); if (wr) wr.onclick = openWeeklyReview;
  main.querySelectorAll("[data-perm]").forEach((el) => (el.onclick = async () => { await window.donna.requestPerm(el.dataset.perm); toast("Opening System Settings — toggle Electron on"); }));
  /* evidence drawer — the Rize pattern: every block explains itself */
  const drawer = $("#tk-drawer");
  main.querySelectorAll("[data-blk]").forEach((b) => (b.onclick = async () => {
    const e = tk.timeline[Number(b.dataset.blk)];
    if (!e) return;
    main.querySelectorAll(".tk-blk.sel").forEach((x) => x.classList.remove("sel"));
    b.classList.add("sel");
    const near = tk.shots.filter((s) => Math.abs(s.t - e.s) < 12 * 60).slice(-1)[0];
    drawer.hidden = false;
    drawer.innerHTML = `<div class="tkd-body">
      <div class="tkd-main">
        <div class="tkd-head"><span class="tk-cat-dot" style="--h:${e.hue}"></span><b>${esc(e.app)}</b><span class="tkd-time">${fmtT(e.s)}–${fmtT(e.s + e.d)} · ${fmtMin(Math.max(1, Math.round(e.d / 60)))}</span><span class="chip">${esc(e.cat)}</span></div>
        ${e.title ? `<div class="tkd-title">${esc(e.title)}</div>` : `<div class="tkd-title dim">no window title — app-only mode</div>`}
        ${e.url ? `<div class="tkd-url">${esc(trunc(e.url, 76))}</div>` : ""}
      </div>
      <div class="tkd-shot" id="tkd-shot"></div>
    </div>`;
    if (near) {
      const td = await window.donna.shotThumb(near.thumb);
      const slot = $("#tkd-shot");
      if (td && slot) { slot.innerHTML = `<img src="${td}" title="nearest screenshot · ${fmtT(near.t)}">`; slot.onclick = () => window.donna.openShot(near.full); }
    }
  }));
  /* screenshots load their thumbs lazily — 12 base64 blobs would bloat first paint */
  main.querySelectorAll(".tk-shot").forEach(async (b) => {
    const td = await window.donna.shotThumb(b.dataset.thumb);
    if (td) b.insertAdjacentHTML("afterbegin", `<img src="${td}">`);
    b.onclick = () => window.donna.openShot(b.dataset.full);
  });
  if (tk.tracking) { clearTimeout(window.__tkTimer); window.__tkTimer = setTimeout(() => { if (view === "rhythm" && !$("#tk-drawer:not([hidden])")) vRhythm(); }, 30000); }
  openCoachButton("activity", { page: "rhythm", pulse: tk.pulse, activeMin: tk.activeMin, deepMin: tk.deepMin, tracking: tk.tracking, tab: tkTab });

  /* patterns: hour-of-day heatmap + day-of-week + interruption counter */
  Promise.all([window.donna.patterns(), window.donna.activityList({ since: Date.now() - 86400000, limit: 200 })]).then(([p, todayItems]) => {
    const slot = $("#pat-slot");
    if (!slot) return;
    const intr = todayItems.filter((e) => /capture|reminder|note_added|goal/.test(e.kind)).length;
    const hMax = Math.max(1, ...p.focusByHour());
    const dMax = Math.max(1, ...p.focusByDay());
    slot.innerHTML = `
      <div class="pat-grid">
        <div class="pat-card">
          <div class="pat-card-h">By hour <span class="pat-when">${p.peak.bestHour ? `peak ${p.peak.bestHour}` : "—"}</span></div>
          <div class="pat-hours">${p.focusByHour().map((m, h) => `<div class="pat-h" style="height:${Math.max(2, (m / hMax) * 36)}px" title="${h}:00 · ${m}m"><span>${h % 6 === 0 ? h : ""}</span></div>`).join("")}</div>
        </div>
        <div class="pat-card">
          <div class="pat-card-h">By day <span class="pat-when">${p.peak.bestDay ? `${p.peak.bestDay} is your day` : "—"}</span></div>
          <div class="pat-days">${p.focusByDay().map((m, i) => `<div class="pat-d"><div class="pat-d-bar" style="height:${Math.max(2, (m / dMax) * 36)}px"></div><span>${["S","M","T","W","T","F","S"][i]}</span></div>`).join("")}</div>
        </div>
        <div class="pat-card">
          <div class="pat-card-h">Interruptions <span class="pat-when">today</span></div>
          <div class="pat-intr"><b>${intr}</b><span>${intr > 5 ? "high" : intr > 2 ? "moderate" : "low"}</span></div>
        </div>
      </div>`;
  });
}

async function vWaiting() {
  const items = await window.donna.waitingList();
  stagger = 0;
  const ageH = (h) => h < 1 ? "just now" : h < 24 ? `${h}h` : h < 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${Math.floor(h / 24)}d`;
  main.innerHTML = `<div class="view">
    <h1 class="h1">Waiting on</h1>
    <p class="sub">Blocked on other people — stale at 3 days, alert at 7${items.length ? `<span class="sep">·</span>${items.length} open${items.filter((w) => w.alert).length ? ` · <b style="color:oklch(0.78 0.18 25)">${items.filter((w) => w.alert).length} alert</b>` : ""}${items.filter((w) => w.stale && !w.alert).length ? ` · <b style="color:oklch(0.78 0.16 70)">${items.filter((w) => w.stale && !w.alert).length} stale</b>` : ""}` : ""}</p>
    <div class="quick-add" style="margin-top:16px"><input id="wait-add" placeholder='Hand-off — "Invoice · Sam"'></div>
    ${items.length ? `<div class="rows" style="margin-top:14px">${items.map((w) => `
      <div class="row wait-row ${w.alert ? "alert" : w.stale ? "stale" : ""}">
        <span class="wait-age ${w.alert ? "alert" : w.stale ? "stale" : ""}">${ageH(w.hrs)}</span>
        <div class="row-body"><div class="row-title">${esc(w.item)}</div>
          <div class="wait-who">on ${esc(w.who || "someone")}${w.alert ? " · alert — send a nudge" : w.stale ? " · time to nudge" : ""}</div></div>
        <button class="wait-clear" data-clear="${w.id}" data-kind="${w.kind}">back to me</button>
      </div>`).join("")}</div>`
      : `<div class="rows" style="margin-top:14px"><div class="empty">Nothing waiting on anyone. Add things you've handed off (invoices, keys, deliverables) so they don't disappear for three weeks.</div></div>`}
  </div>`;
  const inp = $("#wait-add");
  inp.onkeydown = async (e) => {
    if (e.key === "Enter" && inp.value.trim()) {
      const [item, who] = inp.value.split(/[·|,]/).map((s) => s.trim());
      await window.donna.waitingAdd(item, who || "");
      inp.value = ""; vWaiting(); toast("Tracking it");
    }
  };
  main.querySelectorAll("[data-clear]").forEach((b) => (b.onclick = async () => {
    if (b.dataset.kind === "task") await window.donna.setWaiting(b.dataset.clear, null);
    else await window.donna.waitingResolve(b.dataset.clear);
    await refresh(); vWaiting(); toast("Back on you");
  }));
}

/* Plan — the day as a vertical timeline: calendar events + auto-scheduled task
   blocks (time-blocking), a now-line, tap a block to start focus.

   The scheduler (schedule.js) never places a block before "now" — it can't,
   the time is gone. But the OLD render drew the full configured day (9a–7p)
   at fixed height regardless, so any afternoon look was 8 hours of blank
   grid before anything appeared. Fix: compress everything before now into a
   single slim "earlier" strip, and give the real planning window (now →
   day end) generous per-hour height so blocks are actually legible. */
let planLayout = localStorage.getItem("donna.planLayout") || "timeline";
async function vPlan() {
  if (planLayout === "week") return vPlanWeek();
  if (planLayout === "forecast") return vPlanForecast();
  const p = await window.donna.plan();
  stagger = 0;
  const fmtT = (m) => { const h = Math.floor(m / 60), mm = m % 60; const ap = h < 12 ? "a" : "p"; const hh = ((h + 11) % 12) + 1; return `${hh}${mm ? ":" + String(mm).padStart(2, "0") : ""}${ap}`; };
  const dayStartMin = p.dayStart * 60, dayEndMin = p.dayEnd * 60, nowMin = p.nowMin;
  const dayOver = nowMin >= dayEndMin;
  const elapsedMin = Math.max(0, Math.min(nowMin, dayEndMin) - dayStartMin);
  const detailStart = dayOver ? dayEndMin : Math.max(dayStartMin, nowMin);
  const PXM = 1.15; // px/min in the live window — generous enough that a 30m block reads clean
  const detailSpan = Math.max(60, dayEndMin - detailStart);
  const detailH = detailSpan * PXM;
  const top = (m) => (m - detailStart) * PXM;
  const hourMarks = []; for (let h = Math.ceil(detailStart / 60); h <= p.dayEnd; h++) hourMarks.push(h * 60);
  const plannedHrs = p.blocks.reduce((n, b) => n + (b.e - b.s), 0) / 60;
  const pastEvents = p.busy.filter((b) => b.e <= nowMin);
  const futureEvents = p.busy.filter((b) => b.e > nowMin);

  main.innerHTML = `<div class="view">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
      <div><h1 class="h1">Plan</h1>
      <p class="sub">${fmtT(nowMin)} now${p.calOk ? "" : `<span class="sep">·</span>calendar off`}</p></div>
      <div style="display:flex;gap:8px">
        <div class="seg">
          <button class="on" data-planlay="timeline">Timeline</button>
          <button data-planlay="week">Week</button>
          <button data-planlay="forecast">Forecast</button>
        </div>
        <button class="triage-btn" id="replan-btn">↻ Replan</button>
      </div>
    </div>
    ${!p.calOk && p.calReason === "permission" ? `<div class="prod-status" style="margin-top:10px"><span class="ps warn">⚠ grant Calendar access to Electron — System Settings › Privacy › Calendars</span></div>` : ""}

    <div class="pl-board"${si()}>
      <div class="pl-cell"><b>${p.planned}</b><span>block${p.planned !== 1 ? "s" : ""} today</span></div>
      <div class="pl-cell"><b>${plannedHrs ? (Math.round(plannedHrs * 10) / 10) + "h" : "0h"}</b><span>planned</span></div>
      <div class="pl-cell ${p.overflow ? "warn" : ""}"><b>${p.overflow || 0}</b><span>didn't fit</span></div>
    </div>

    ${elapsedMin > 0 ? `<div class="pl-elapsed"><span class="pl-elapsed-label">Earlier — ${fmtT(dayStartMin)} → ${fmtT(Math.min(nowMin, dayEndMin))}</span><span class="pl-elapsed-hint">${pastEvents.length ? pastEvents.length + " event" + (pastEvents.length !== 1 ? "s" : "") + " passed" : "nothing logged"}</span></div>` : ""}

    ${dayOver ? `<div class="pl-dayover">☾ The work day's over.<button class="pl-tmrw" data-goto="today">Plan tomorrow morning →</button></div>` : `
    <div class="tl" style="height:${detailH + 12}px">
      ${hourMarks.map((hm) => `<div class="tl-hour" style="top:${top(hm)}px"><span class="tl-h">${fmtT(hm)}</span></div>`).join("")}
      <div class="tl-now" style="top:${top(nowMin)}px"><span class="tl-now-dot"></span><span class="tl-now-label">now</span></div>
      ${futureEvents.map((b) => `<div class="tl-event" style="top:${top(Math.max(b.s, nowMin))}px;height:${Math.max(18, (b.e - Math.max(b.s, nowMin)) * PXM)}px"><span>${esc(b.title)}</span></div>`).join("")}
      ${p.blocks.map((b) => `<div class="tl-block p${b.priority} ${b.doing ? "doing" : ""}" style="top:${top(b.s)}px;height:${Math.max(30, (b.e - b.s) * PXM)}px" data-start="${b.id}">
        <span class="tl-block-t">${esc(trunc(b.title, 46))}</span><span class="tl-block-time">${fmtT(b.s)}–${fmtT(b.e)}</span></div>`).join("")}
      ${!p.blocks.length ? `<div class="pl-empty">Nothing scheduled yet — <a data-goto="tasks">add tasks</a> or hit <b>Replan</b>.</div>` : ""}
    </div>`}
    <p class="hint" style="margin-top:14px">Auto-blocked by priority around your calendar, from now forward. Tap a block to start focus.</p>
  </div>`;
  $("#replan-btn").onclick = () => { vPlan(); toast("Replanned around now"); };
  main.querySelectorAll("[data-goto]").forEach((el) => (el.onclick = () => gotoView(el.dataset.goto)));
  main.querySelectorAll("[data-planlay]").forEach((b) => (b.onclick = () => { planLayout = b.dataset.planlay; localStorage.setItem("donna.planLayout", planLayout); vPlan(); }));
  main.querySelectorAll(".tl-block[data-start]").forEach((el) => (el.onclick = async () => {
    const t = data.open.find((x) => x.id === el.dataset.start);
    await window.donna.setStatus(el.dataset.start, t?.status === "doing" ? "todo" : "doing");
    await refresh(); if (view === "plan") vPlan(); renderCompactBody();
    toast(t?.status === "doing" ? "Paused" : "On it — focus started");
  }));
  openCoachButton("plan", { layout: "timeline", planned: p.planned, blocks: p.blocks.length, overflow: p.overflow || 0, fitted: plannedHrs ? Math.round(plannedHrs * 10) / 10 : 0, busyEvents: p.busy.length, calOk: p.calOk });
}

/* Plan — Week view: the 7-day agenda, so a glance answers "what's coming" —
   the timeline only ever answers "what's now". Groups open tasks by due date;
   undated-but-active tasks land in a trailing "Unscheduled" lane instead of
   vanishing, since a plan that hides work isn't a plan. */
async function vPlanWeek() {
  stagger = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i); return d; });
  const iso = (d) => d.toISOString().slice(0, 10);
  const open = data.open.filter((t) => t.status !== "doing" && t.bucket !== "someday");
  const byDay = days.map((d) => open.filter((t) => t.dueAt && t.dueAt.slice(0, 10) === iso(d)));
  const scheduledIds = new Set(byDay.flat().map((t) => t.id));
  const unscheduled = open.filter((t) => !scheduledIds.has(t.id) && !t.dueAt);
  const dName = (d, i) => i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "long" });
  main.innerHTML = `<div class="view wide">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
      <div><h1 class="h1">Plan</h1><p class="sub">The 7 days ahead, at a glance</p></div>
      <div style="display:flex;gap:8px">
        <div class="seg">
          <button data-planlay="timeline">Timeline</button>
          <button class="on" data-planlay="week">Week</button>
        </div>
      </div>
    </div>
    <div class="pl-week">
      ${days.map((d, i) => `<div class="pl-wcol ${i === 0 ? "wtoday" : ""}"${si()}>
        <div class="pl-whead"><span>${dName(d, i)}</span><b>${d.getDate()}</b></div>
        <div class="pl-wbody">
          ${byDay[i].length ? byDay[i].map((t) => `<div class="pl-wcard p${t.priority}" data-wtask="${t.id}">${esc(trunc(t.title, 50))}</div>`).join("") : `<div class="pl-wempty">—</div>`}
        </div>
      </div>`).join("")}
    </div>
    ${unscheduled.length ? `<div class="sec" style="margin-top:18px">Unscheduled <b>${unscheduled.length}</b></div>
      <div class="pl-unsched">${unscheduled.map((t) => `<div class="pl-wcard p${t.priority}" data-wtask="${t.id}">${esc(trunc(t.title, 60))}</div>`).join("")}</div>` : ""}
  </div>`;
  main.querySelectorAll("[data-planlay]").forEach((b) => (b.onclick = () => { planLayout = b.dataset.planlay; localStorage.setItem("donna.planLayout", planLayout); vPlan(); }));
  main.querySelectorAll("[data-wtask]").forEach((el) => (el.onclick = () => gotoView("tasks")));
  openCoachButton("plan", { layout: "week", unscheduled: unscheduled.length, totalOpen: open.length });
}

/* Notes — durable knowledge library (distinct from Capture's fast inbox). */
async function vNotes(root = main, bare = false) {
  const notes = await window.donna.notesList();
  stagger = 0;
  root.innerHTML = `${bare ? "" : `<div class="view"><h1 class="h1">Notes</h1><p class="sub">Your durable library — decisions, references, playbooks. Use <code>[[name]]</code> to backlink to any task, goal, note, or idea.${notes.length ? `<span class="sep">·</span>${notes.length}` : ""}</p>`}
    <div class="quick-add" style="margin-top:16px"><input id="note-add" placeholder="New note — type a title, then ↵"></div>
    ${notes.length ? `<div class="note-list">${notes.map((n) => `
      <div class="note-card" data-id="${n.id}">
        <div class="note-title" data-expand>${esc(n.title)}</div>
        <textarea class="note-edit" data-body="${n.id}" placeholder="Write… use [[name]] to backlink">${esc(n.body)}</textarea>
        <div class="note-foot"><span>${new Date(n.updatedAt).toLocaleDateString()}</span><button class="note-del" data-del="${n.id}">delete</button></div>
        <div class="note-bk" data-bk-for="${n.id}" hidden></div>
      </div>`).join("")}</div>`
      : `<div class="rows" style="margin-top:14px"><div class="empty">No notes yet. Keep decisions, references and playbook snippets here — anything worth remembering that isn't a task.</div></div>`}
  ${bare ? "" : "</div>"}`;
  const inp = $("#note-add");
  inp.onkeydown = async (e) => { if (e.key === "Enter" && inp.value.trim()) { await window.donna.notesAdd(inp.value.trim(), ""); inp.value = ""; vNotes(root, bare); } };
  root.querySelectorAll("[data-expand]").forEach((el) => (el.onclick = () => el.closest(".note-card").classList.toggle("open")));
  root.querySelectorAll("[data-body]").forEach((t) => (t.onblur = async () => { await window.donna.notesUpdate(t.dataset.body, { body: t.value }); paintBacklinks(t.dataset.body); }));
  root.querySelectorAll("[data-del]").forEach((el) => (el.onclick = async (e) => { e.stopPropagation(); await window.donna.notesRemove(el.dataset.del); vNotes(root, bare); toast("Deleted"); }));
  if (!bare) openCoachButton("notes", { tab: "notes", total: notes.length, recent: notes.slice(0, 3).map((n) => n.title) });
  /* paint backlinks under each card when expanded */
  async function paintBacklinks(noteId) {
    const slot = root.querySelector(`[data-bk-for="${noteId}"]`);
    if (!slot) return;
    const bks = await window.donna.backlinksFor({ kind: "note", id: noteId });
    if (!bks.length) { slot.hidden = true; slot.innerHTML = ""; return; }
    slot.hidden = false;
    slot.innerHTML = `<div class="note-bk-h">Linked from (${bks.length})</div>${bks.map((b) => `<div class="note-bk-row"><span class="note-bk-k">${esc(b.kind)}</span>${esc(trunc(b.label, 60))}</div>`).join("")}`;
  }
  /* paint on load only for the first card so it doesn't spam */
  if (notes[0]) paintBacklinks(notes[0].id);
}

/* People — light CRM with the drift radar (Clay/Dex/Monica): every person has
   a cadence; warmth decays toward it; drifting people surface first. */
async function vPeople() {
  const people = await window.donna.peopleList();
  stagger = 0;
  const drifting = people.filter((p) => p.drifting);
  const sorted = [...people].sort((a, b) => (b.drifting ? 1 : 0) - (a.drifting ? 1 : 0) || (a.warmth ?? 101) - (b.warmth ?? 101));
  // no warmth ring until there's a first contact logged — the card already
  // says "no contact logged" below; a ghost ring up top just doubled that
  // message as an unlabeled circle that read like a dead button.
  const warmthRing = (p) => p.warmth === null ? "" : `<div class="ppl-warmth ${p.drifting ? "cold" : p.warmth < 40 ? "cooling" : ""}" style="--pct:${p.warmth}" title="warmth ${p.warmth}% · every ${p.cadenceDays}d">${p.daysSince}d</div>`;
  main.innerHTML = `<div class="view">
    <h1 class="h1">People</h1>
    <p class="sub">Your circle — cadence, warmth, and what they owe you</p>
    ${drifting.length ? `<div class="coverage-banner">☎ <span><b>${esc(drifting.map((p) => p.name).join(", "))}</b> ${drifting.length > 1 ? "are" : "is"} drifting past cadence — one message keeps it warm.</span></div>` : ""}
    <div class="quick-add" style="margin-top:14px"><input id="ppl-add" placeholder='Add someone — "Mikee · VA", then ↵'></div>
    <div class="ppl-list">${sorted.map((p) => `
      <div class="ppl-card ${p.drifting ? "drifting" : ""}"${si()}>
        <div class="ppl-av">${esc((p.name || "?")[0])}</div>
        <div class="ppl-body">
          <div class="ppl-name">${esc(p.name)}${p.waitingCount ? `<span class="ppl-badge ${p.staleCount ? "stale" : ""}">${p.waitingCount} waiting</span>` : ""}</div>
          <div class="ppl-role">${esc(p.role || "")}</div>
          <textarea class="ppl-notes" data-id="${p.id}" placeholder="Notes on ${esc(p.name)}…">${esc(p.notes || "")}</textarea>
          <div class="ppl-foot">
            <button class="ppl-touch" data-touch="${p.id}">✓ talked</button>
            <button class="ppl-cad" data-cad="${p.id}" title="contact cadence — click to cycle">every ${p.cadenceDays}d</button>
            ${p.lastContactAt ? `<span class="ppl-last">last · ${new Date(p.lastContactAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>` : `<span class="ppl-last">no contact logged</span>`}
          </div>
        </div>
        ${warmthRing(p)}
      </div>`).join("")}</div>
  </div>`;
  const inp = $("#ppl-add");
  inp.onkeydown = async (e) => { if (e.key === "Enter" && inp.value.trim()) { const [name, role] = inp.value.split(/[·|,]/).map((s) => s.trim()); await window.donna.peopleAdd(name, role || ""); inp.value = ""; vPeople(); } };
  main.querySelectorAll(".ppl-notes").forEach((t) => (t.onblur = async () => { await window.donna.peopleUpdate(t.dataset.id, { notes: t.value }); }));
  main.querySelectorAll("[data-touch]").forEach((b) => (b.onclick = async () => { await window.donna.peopleTouch(b.dataset.touch); try { snd.chime(); } catch {} toast("Warm again"); vPeople(); }));
  main.querySelectorAll("[data-cad]").forEach((b) => (b.onclick = async () => {
    const p = people.find((x) => x.id === b.dataset.cad);
    const steps = [3, 7, 14, 30];
    const next = steps[(steps.indexOf(p.cadenceDays) + 1) % steps.length];
    await window.donna.peopleUpdate(p.id, { cadenceDays: next });
    vPeople();
  }));
  openCoachButton("people", {
    total: people.length,
    drifting: drifting.length,
    topDrift: drifting.slice(0, 3).map((p) => p.name),
    waiting: people.reduce((n, p) => n + (p.waitingCount || 0), 0),
  });
}

/* Memory — what Donna knows about you. Visible, editable, deletable: trust
   requires inspectability (the Dot lesson). Facts land here ambiently from
   chat with a "remembered ✓" glint, or by hand below. */
async function vMemory() {
  const facts = await window.donna.memoryList();
  stagger = 0;
  const KIND_HUES = { person: 25, preference: 250, date: 85, project: 330, health: 160, fact: 200 };
  main.innerHTML = `<div class="view">
    <h1 class="h1">Memory</h1>
    <p class="sub">What Donna knows about you — she mines chat quietly, you stay in charge${facts.length ? `<span class="sep">·</span>${facts.length} facts` : ""}</p>
    <div class="quick-add" style="margin-top:16px"><input id="mem-add" placeholder='Teach her — "gym is at 6pm tuesdays" then ↵'></div>
    ${facts.length ? `<div class="mem-list">${facts.map((f) => `
      <div class="mem-row"${si()}>
        <button class="mem-kind" data-kind="${f.id}" style="--h:${KIND_HUES[f.kind] || 200}">${esc(f.kind)}</button>
        <input class="mem-fact" data-fact="${f.id}" value="${esc(f.fact)}">
        <span class="mem-src">${esc(f.source)} · ${new Date(f.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
        <button class="mem-del" data-del="${f.id}">✕</button>
      </div>`).join("")}</div>`
      : `<div class="rows" style="margin-top:14px"><div class="empty">Nothing yet. Talk to Donna in Ask — she'll quietly remember what matters (you'll see a <b>remembered ✓</b> flash). Everything lands here where you can correct or delete it.</div></div>`}
  </div>`;
  const inp = $("#mem-add");
  inp.onkeydown = async (e) => { if (e.key === "Enter" && inp.value.trim()) { await window.donna.memoryAdd(inp.value.trim(), "fact"); inp.value = ""; try { snd.pop(); } catch {} vMemory(); } };
  main.querySelectorAll("[data-fact]").forEach((el) => (el.onblur = () => window.donna.memoryUpdate(el.dataset.fact, { fact: el.value })));
  main.querySelectorAll("[data-kind]").forEach((b) => (b.onclick = async () => {
    const f = facts.find((x) => x.id === b.dataset.kind);
    const kinds = ["fact", "person", "preference", "date", "project", "health"];
    const next = kinds[(kinds.indexOf(f.kind) + 1) % kinds.length];
    await window.donna.memoryUpdate(f.id, { kind: next });
    vMemory();
  }));
  main.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { await window.donna.memoryRemove(b.dataset.del); vMemory(); toast("Forgotten"); }));
  openCoachButton("memory", { facts: facts.length, byKind: facts.reduce((m, f) => { m[f.kind] = (m[f.kind] || 0) + 1; return m; }, {}), recent: facts.slice(0, 3).map((f) => f.fact) });
}

/* Life — the wheel (Designing Your Life). Score Work/Money/Health/Relationships
   before planning anything, because a goal list can't fix what it never named. */
const LIFE_META = {
  work: { label: "Work", hue: 250 },
  money: { label: "Money", hue: 85 },
  health: { label: "Health", hue: 160 },
  relationships: { label: "Relationships", hue: 25 },
};
/* Life — the vision system. Where you want to be at each horizon, per area,
   broken into steps. Set the far star, work back to this month. */
const HORIZON_META = { "1mo": "1 month", "3mo": "3 months", "1yr": "1 year", "5yr": "5 years" };
let lifeHz = localStorage.getItem("donna.lifeHz") || "1yr";
async function vLife() {
  stagger = 0;
  const data = await window.donna.visionGet();
  const areas = ["work", "money", "health", "relationships"];
  const cell = (a) => data[`${lifeHz}|${a}`] || { vision: "", steps: [] };
  const totalSteps = areas.reduce((n, a) => n + cell(a).steps.length, 0);
  const doneSteps = areas.reduce((n, a) => n + cell(a).steps.filter((s) => s.done).length, 0);
  main.innerHTML = `<div class="view wide">
    <div class="lib-head">
      <div><h1 class="h1">Life</h1><p class="sub">Where you're headed — set the star, work it back to now${totalSteps ? `<span class="sep">·</span>${doneSteps}/${totalSteps} steps done` : ""}</p></div>
      <div class="seg vz-seg">${Object.entries(HORIZON_META).map(([k, v]) => `<button data-hz="${k}" class="${lifeHz === k ? "on" : ""}">${v}</button>`).join("")}</div>
    </div>
    <div class="vz-grid">
      ${areas.map((a) => { const c = cell(a); const m = LIFE_META[a]; const done = c.steps.filter((s) => s.done).length;
        return `<div class="vz-card" style="--h:${m.hue}"${si()}>
          <div class="vz-card-head"><span class="vz-dot"></span>${esc(m.label)}${c.steps.length ? `<span class="vz-prog">${done}/${c.steps.length}</span>` : ""}</div>
          <textarea class="vz-vision" data-vision="${a}" placeholder="In ${HORIZON_META[lifeHz]}, ${m.label.toLowerCase()} looks like…">${esc(c.vision)}</textarea>
          <div class="vz-steps">
            ${c.steps.map((s) => `<div class="vz-step ${s.done ? "done" : ""}"><button class="vz-check" data-step="${a}|${s.id}">${CHECK_SVG}</button><span>${esc(s.text)}</span><button class="vz-step-x" data-delstep="${a}|${s.id}">×</button></div>`).join("")}
          </div>
          <div class="vz-card-foot">
            <input class="vz-add" data-addstep="${a}" placeholder="Add a step ↵">
            <button class="vz-break" data-break="${a}" title="Let Donna break the vision into steps">✦ break it down</button>
          </div>
        </div>`; }).join("")}
    </div>
  </div>`;
  main.querySelector(".vz-seg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; lifeHz = b.dataset.hz; localStorage.setItem("donna.lifeHz", lifeHz); vLife(); });
  main.querySelectorAll("[data-vision]").forEach((t) => (t.onblur = () => window.donna.visionSet(lifeHz, t.dataset.vision, t.value)));
  main.querySelectorAll("[data-step]").forEach((b) => (b.onclick = async () => { const [a, id] = b.dataset.step.split("|"); await window.donna.visionToggleStep(lifeHz, a, id); try { snd.tick(); } catch {} vLife(); }));
  main.querySelectorAll("[data-delstep]").forEach((b) => (b.onclick = async () => { const [a, id] = b.dataset.delstep.split("|"); await window.donna.visionRemoveStep(lifeHz, a, id); vLife(); }));
  main.querySelectorAll("[data-addstep]").forEach((inp) => (inp.onkeydown = async (e) => { if (e.key === "Enter" && inp.value.trim()) { await window.donna.visionAddStep(lifeHz, inp.dataset.addstep, inp.value.trim()); vLife(); } }));
  main.querySelectorAll("[data-break]").forEach((b) => (b.onclick = async () => {
    const a = b.dataset.break; const v = (cell(a).vision || "").trim();
    if (!v) { toast("Write the vision first, then I'll break it down"); return; }
    b.textContent = "✦ thinking…"; b.disabled = true;
    const steps = await window.donna.visionBreakdown(HORIZON_META[lifeHz], LIFE_META[a].label, v);
    if (steps && steps.length) { await window.donna.visionAddSteps(lifeHz, a, steps); toast(`${steps.length} steps added`); vLife(); }
    else { b.textContent = "✦ break it down"; b.disabled = false; toast("Couldn't break it down — try again"); }
  }));
  openCoachButton("life", { horizon: lifeHz, areas: areas.map((a) => ({ area: a, steps: cell(a).steps.length, done: cell(a).steps.filter((s) => s.done).length, vision: cell(a).vision ? true : false })) });
}

/* Goals — the longer horizon above tasks, with progress. */
/* Goals — OKR × 12-Week-Year × identity. Objective + why → key results (lag) +
   milestones (path) + the one lever + a weekly commitment score (lead).

   A goal at 0% used to render as a bare dark circle — technically correct,
   visually dead. Fixed: the ring is tinted by the goal's own domain (so a
   glance at the list reads like a little wheel-of-life, not four identical
   blue dials) and always carries a faint track so it never looks broken.
   The collapsed row also now surfaces the ONE thing worth knowing without
   opening it — the next concrete step — so a closed card still tells you
   something instead of being a dead shell waiting to be clicked. */
function goalNextAction(g) {
  if (g.done) return null;
  const openMs = (g.milestones || []).find((m) => !m.done);
  if (openMs) return `→ ${trunc(openMs.text, 46)}`;
  const openKr = (g.keyResults || []).filter((k) => k.target).sort((a, b) => ((a.current || 0) / a.target) - ((b.current || 0) / b.target))[0];
  if (openKr && (openKr.current || 0) < openKr.target) return `→ ${openKr.target - (openKr.current || 0)}${openKr.unit ? " " + openKr.unit : ""} to go on ${trunc(openKr.text, 34)}`;
  if (!(g.keyResults || []).length) return `→ add a key result — a number that proves it's done`;
  return null;
}
function goalCard(g, linkedTasks = 0) {
  const krPct = (k) => (k.target ? Math.min(100, Math.round((k.current || 0) / k.target * 100)) : 0);
  const wk = g.week || { committed: 0, done: 0 };
  const wkPct = wk.committed ? Math.round(wk.done / wk.committed * 100) : 0;
  const dm = LIFE_META[g.domain] || { label: g.domain || "work", hue: 250 };
  const next = goalNextAction(g);
  return `<div class="goal2 ${g.done ? "done" : ""}" data-id="${g.id}" style="--h:${dm.hue}">
    <div class="goal2-head" data-gexpand="${g.id}">
      <div class="goal2-ring" style="--pct:${g.pct};--h:${dm.hue}"><span>${g.pct}<b>%</b></span></div>
      <div class="goal2-hd">
        <div class="goal2-obj">${esc(g.objective)}</div>
        <div class="goal2-meta"><span class="domain-badge" style="--h:${dm.hue}">${esc(dm.label)}</span><span class="goal2-horizon">${g.horizon === "12wk" ? "12-week" : esc(g.horizon)}</span><span class="goal2-cycle">W${g.cycleWeek || 1}/12 · ${g.cycleDaysLeft != null ? g.cycleDaysLeft : 84}d left</span>${g.oneThing ? `<span class="goal2-lead" title="Lead this week">◷ lead set</span>` : ""}${linkedTasks ? `<span class="goal2-tasks" title="Open tasks linked to this goal">${linkedTasks} task${linkedTasks === 1 ? "" : "s"}</span>` : ""}${wk.committed ? `<span class="goal2-wk-mini ${wkPct >= 100 ? "hit" : ""}">${wk.done}/${wk.committed} this wk</span>` : ""}</div>
        ${next ? `<div class="goal2-next">${esc(next)}</div>` : g.why ? `<div class="goal2-next dim">${esc(trunc(g.why, 60))}</div>` : ""}
      </div>
      <svg class="goal2-caret" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4"/></svg>
    </div>
    <div class="goal2-body">
      <div class="goal2-field"><span class="goal2-flabel">Why it matters — who this makes you</span><input class="goal2-in" data-why="${g.id}" value="${esc(g.why || "")}" placeholder="so I trust the pipeline runs without me babysitting it"></div>
      <div class="goal2-field"><span class="goal2-flabel">The one thing — the single lever that moves this most</span><input class="goal2-in one" data-one="${g.id}" value="${esc(g.oneThing || "")}" placeholder="do THIS and the rest gets easier or unnecessary"></div>

      <div class="goal2-sec">Key results <span>measurable outcomes</span></div>
      ${(g.keyResults || []).length ? (g.keyResults || []).map((k) => `<div class="kr">
        <div class="kr-top"><span class="kr-text">${esc(k.text)}</span><span class="kr-num">${k.current || 0}/${k.target}${k.unit ? " " + esc(k.unit) : ""}</span></div>
        <div class="kr-bar"><div class="kr-fill" style="width:${krPct(k)}%"></div></div>
        <div class="kr-acts"><button class="kr-step" data-krdec="${g.id}|${k.id}">−</button><button class="kr-step" data-krinc="${g.id}|${k.id}">+</button><button class="kr-del" data-krdel="${g.id}|${k.id}">remove</button></div>
      </div>`).join("") : `<p class="goal2-emptyhint">A number that proves the objective is actually done — not a restatement of it. "30 reels live" the objective → "reels live =30 reels" the key result.</p>`}
      <input class="goal2-krin" data-addkr="${g.id}" placeholder='Add key result — "reels live =30 reels" ↵'>

      <div class="goal2-sec">Milestones <span>the path</span></div>
      ${(g.milestones || []).length ? (g.milestones || []).map((m) => `<div class="ms"><button class="mscheck ${m.done ? "on" : ""}" data-mstog="${g.id}|${m.id}">${CHECK_SVG}</button><span class="ms-t ${m.done ? "done" : ""}">${esc(m.text)}</span><button class="ms-del" data-msdel="${g.id}|${m.id}">✕</button></div>`).join("") : `<p class="goal2-emptyhint">The 3-5 waypoints between here and done — the path, not the outcome.</p>`}
      <input class="goal2-msin" data-addms="${g.id}" placeholder="Add milestone ↵">

      <div class="goal2-week">
        <div class="goal2-week-ring" style="--pct:${wkPct}"><span>${wkPct}<b>%</b></span></div>
        <div class="goal2-week-body"><div class="goal2-week-l">This week's execution</div><div class="goal2-week-s">${wk.done}/${wk.committed || "—"} committed actions done — <b>lead measure, the one you control</b></div></div>
        <button class="goal2-week-btn" data-week="${g.id}">log</button>
      </div>
      <div class="goal2-foot">${g.done ? `<button class="goal2-reopen" data-greopen="${g.id}">↺ reopen</button>` : `<button class="goal2-reopen" data-gdone="${g.id}">✓ mark reached</button>`}<button class="goal2-del" data-gdel="${g.id}">delete goal</button></div>
    </div>
  </div>`;
}

let goalDomFilter = localStorage.getItem("donna.goalDom") || "all";

/* Cycle header — 12-Week-Year command center. Big "Week 7 of 12" + cycle
   progress bar, days-left, aggregate lead-measure scorecard, domain coverage.
   Sits above the goal cards as the persistent pulse of the quarter. */
function cycleHeaderHtml(goals) {
  // Mirror of goals.aggregateWeek(goals) — server-side helper, but the
  // data is already on the goals[] returned by goalsList(), so we sum client-
  // side. Avoids a new IPC for one number.
  const active = goals.filter((g) => !g.done && g.week && (g.week.committed || 0) > 0);
  const committed = active.reduce((n, g) => n + (g.week.committed || 0), 0);
  const done = active.reduce((n, g) => n + (g.week.done || 0), 0);
  const leadPct = committed ? Math.round(done / committed * 100) : 0;
  // Cycle week — anchored to the most-recently-created active goal's cycle,
  // so the whole page speaks about the same week (every goal is on the same
  // Monday-aligned cycle anyway, but anchoring to one keeps it deterministic).
  const ref = goals.find((g) => !g.done) || goals[0] || { cycleWeek: 1, cycleDaysLeft: 84 };
  const week = ref.cycleWeek || 1;
  const days = ref.cycleDaysLeft != null ? ref.cycleDaysLeft : 84;
  const weekPct = Math.round((week - 1) / 12 * 100);
  // Lead-measure semantic: 100%+ on pace, 60–99 behind, <60 stalled
  const leadState = leadPct >= 100 ? "on" : leadPct >= 60 ? "behind" : leadPct > 0 ? "stalled" : "off";
  // Domain coverage: 4 mini-bars tinted by LIFE_META
  const cov = { work: 0, money: 0, health: 0, relationships: 0 };
  for (const g of goals) if (!g.done) cov[g.domain] = (cov[g.domain] || 0) + 1;
  const covMax = Math.max(1, ...Object.values(cov));
  return `<div class="cyc">
    <div class="cyc-left">
      <div class="cyc-eyebrow">12-week cycle</div>
      <div class="cyc-week"><span class="cyc-n">${week}</span><span class="cyc-of">of 12</span></div>
      <div class="cyc-bar"><div class="cyc-bar-fill" style="width:${weekPct}%"></div></div>
      <div class="cyc-meta">
        <span class="cyc-days"><b>${days}</b> day${days === 1 ? "" : "s"} left</span>
        <span class="cyc-sep">·</span>
        <span class="cyc-actives">${active.length} active goal${active.length === 1 ? "" : "s"}</span>
      </div>
    </div>
    <div class="cyc-right">
      <div class="cyc-score ${leadState}">
        <div class="cyc-score-n"><span>${leadPct}</span><b>%</b></div>
        <div class="cyc-score-l">lead this week</div>
        <div class="cyc-score-s">${done}/${committed || "—"} committed actions done${committed ? "" : " — log one to start tracking"}</div>
      </div>
      <div class="cyc-cov">
        <div class="cyc-cov-l">Domain coverage</div>
        <div class="cyc-cov-bars">${["work", "money", "health", "relationships"].map((d) => {
          const m = LIFE_META[d]; const n = cov[d] || 0;
          const pct = Math.round(n / covMax * 100);
          return `<div class="cyc-cov-row${n === 0 ? " empty" : ""}" style="--h:${m.hue}">
            <span class="cyc-cov-dot"></span>
            <span class="cyc-cov-name">${m.label}</span>
            <div class="cyc-cov-bar"><div style="width:${pct}%"></div></div>
            <span class="cyc-cov-n">${n}</span>
          </div>`;
        }).join("")}</div>
      </div>
      <button class="cyc-ai" id="cyc-ai" title="Where am I stuck?">✦</button>
    </div>
  </div>`;
}

/* "Where am I stuck?" — one-line AI read of the goals. Tooltip on the
   right of the cycle header. Fades on outside click / Esc. */
function showAiTip(text) {
  let tip = $("#cyc-tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "cyc-tip";
    tip.className = "cyc-tip";
    document.body.appendChild(tip);
    const dismiss = (e) => { if (tip && (tip.contains(e.target) || e.target.closest("#cyc-ai"))) return; tip.classList.remove("show"); setTimeout(() => tip.remove(), 180); document.removeEventListener("click", dismiss); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") dismiss(e); };
    setTimeout(() => { document.addEventListener("click", dismiss); document.addEventListener("keydown", esc); }, 0);
  }
  tip.innerHTML = `<span class="cyc-tip-l">✦ Donna</span><span class="cyc-tip-t">${esc(text)}</span>`;
  const ai = $("#cyc-ai");
  if (ai) {
    const r = ai.getBoundingClientRect();
    tip.style.top = (r.bottom + 8) + "px";
    tip.style.right = (window.innerWidth - r.right) + "px";
  }
  requestAnimationFrame(() => tip.classList.add("show"));
}

async function vGoals() {
  const [goals, coverage, tasks] = await Promise.all([window.donna.goalsList(), window.donna.goalsDomainCoverage(), window.donna.tasks().catch(() => ({ open: [] }))]);
  stagger = 0;
  const empty = Object.entries(coverage).filter(([, n]) => n === 0).map(([d]) => (LIFE_META[d] || { label: d }).label);
  const domains = ["work", "money", "health", "relationships"];
  const shown = goalDomFilter === "all" ? goals : goals.filter((g) => g.domain === goalDomFilter);
  const activeCount = (d) => goals.filter((g) => g.domain === d && !g.done).length;
  // Linked-task count per goal — power-user signal: how much of the day's
  // queue is pulling toward this objective.
  const linkedByGoal = {};
  for (const t of (tasks.open || [])) if (t.objectiveId) linkedByGoal[t.objectiveId] = (linkedByGoal[t.objectiveId] || 0) + 1;
  main.innerHTML = `<div class="view">
    <div class="lib-head">
      <div><h1 class="h1">Goals</h1><p class="sub">Objectives → key results → the one lever → weekly execution</p></div>
      <div class="seg vz-seg goals-seg">
        <button data-dom="all" class="${goalDomFilter === "all" ? "on" : ""}">All<span class="goals-seg-n">${goals.filter((g) => !g.done).length}</span></button>
        ${domains.map((d) => `<button data-dom="${d}" class="${goalDomFilter === d ? "on" : ""}" style="--h:${LIFE_META[d].hue}">${LIFE_META[d].label}<span class="goals-seg-n">${activeCount(d)}</span></button>`).join("")}
      </div>
    </div>
    ${cycleHeaderHtml(goals)}
    <div class="quick-add" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      <input id="goal-add" style="flex:1;min-width:240px" placeholder="New objective — the ambitious 12-week outcome, then ↵">
      <select id="goal-domain" class="domain-select">
        <option value="work">Work</option><option value="money">Money</option><option value="health">Health</option><option value="relationships">Relationships</option>
      </select>
      <button class="hero-btn" id="goal-template-btn" title="Start from a template" style="background:transparent;color:var(--mut);border:1px solid var(--line)">✦ From template</button>
    </div>
    <div id="goal-template-row" hidden></div>
    ${empty.length ? `<div class="coverage-banner">⚠ <span><b>${esc(empty.join(", "))}</b> ${empty.length > 1 ? "have" : "has"} no active goals this quarter — the 12 Week Year rule is every domain gets a seat.</span></div>` : ""}
    ${shown.length ? `<div class="goal-list">${shown.map((g) => goalCard(g, linkedByGoal[g.id] || 0)).join("")}</div>`
      : goals.length ? `<div class="rows" style="margin-top:14px"><div class="empty">No goals in this domain yet.</div></div>`
      : `<div class="rows" style="margin-top:14px"><div class="empty">No goals yet. Name an ambitious <b>12-week objective</b> — "30 World Cup reels live", "8 accounts posting daily" — then give it measurable <b>key results</b>, the <b>one lever</b> that moves it, and score your <b>weekly execution</b>. That's OKRs + The 12 Week Year, the way the best operators actually hit goals.</div></div>`}
  </div>`;
  const inp = $("#goal-add");
  const domSel = $("#goal-domain");
  if (goalDomFilter !== "all") domSel.value = goalDomFilter;
  inp.onkeydown = async (e) => { if (e.key === "Enter" && inp.value.trim()) { await window.donna.goalsAdd(inp.value.trim(), "", domSel.value); inp.value = ""; vGoals(); } };
  /* goal templates — one-click 12-week OKR / habit stack / ship-it shells */
  const tbtn = $("#goal-template-btn");
  if (tbtn) tbtn.onclick = async () => {
    const row = $("#goal-template-row");
    if (row && !row.hidden) { row.hidden = true; row.innerHTML = ""; return; }
    const ts = await window.donna.goalsListTemplates();
    row.hidden = false;
    row.innerHTML = `<div class="goal-templates">${ts.map((t) => `<button class="goal-tpl" data-tpl="${esc(t.key)}">
      <div class="goal-tpl-l">${esc(t.label)}</div>
      <div class="goal-tpl-d">${esc(t.objective)}</div>
    </button>`).join("")}</div>`;
    row.querySelectorAll("[data-tpl]").forEach((b) => (b.onclick = async () => {
      const id = await window.donna.goalsApplyTemplate(b.dataset.tpl);
      if (id) { toast("Goal created — edit to fill in your specifics"); gotoView("goals"); setTimeout(() => { try { vGoals(); } catch {} }, 200); }
    }));
  };
  main.querySelector(".goals-seg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; goalDomFilter = b.dataset.dom; localStorage.setItem("donna.goalDom", goalDomFilter); vGoals(); });
  const sp = (d) => d.split("|");
  main.querySelectorAll("[data-gexpand]").forEach((el) => (el.onclick = (e) => { if (e.target.closest("input,button,.goal2-body")) return; el.closest(".goal2").classList.toggle("open"); }));
  main.querySelectorAll("[data-why]").forEach((el) => (el.onblur = () => window.donna.goalsUpdate(el.dataset.why, { why: el.value })));
  main.querySelectorAll("[data-one]").forEach((el) => (el.onblur = () => window.donna.goalsUpdate(el.dataset.one, { oneThing: el.value })));
  main.querySelectorAll("[data-krinc]").forEach((b) => (b.onclick = async () => { const [id, kr] = sp(b.dataset.krinc); const k = goals.find((x) => x.id === id).keyResults.find((y) => y.id === kr); await window.donna.goalsUpdateKR(id, kr, { current: (k.current || 0) + 1 }); reopenGoals(id); }));
  main.querySelectorAll("[data-krdec]").forEach((b) => (b.onclick = async () => { const [id, kr] = sp(b.dataset.krdec); const k = goals.find((x) => x.id === id).keyResults.find((y) => y.id === kr); await window.donna.goalsUpdateKR(id, kr, { current: Math.max(0, (k.current || 0) - 1) }); reopenGoals(id); }));
  main.querySelectorAll("[data-krdel]").forEach((b) => (b.onclick = async () => { const [id, kr] = sp(b.dataset.krdel); await window.donna.goalsRemoveKR(id, kr); reopenGoals(id); }));
  main.querySelectorAll("[data-addkr]").forEach((el) => (el.onkeydown = async (e) => { if (e.key === "Enter" && el.value.trim()) { const m = el.value.match(/=\s*(\d+)\s*([a-z]*)\s*$/i); await window.donna.goalsAddKR(el.dataset.addkr, el.value.replace(/=\s*\d+\s*[a-z]*\s*$/i, "").trim(), m ? m[1] : 0, m ? m[2] : ""); reopenGoals(el.dataset.addkr); } }));
  main.querySelectorAll("[data-mstog]").forEach((b) => (b.onclick = async () => { const [id, m] = sp(b.dataset.mstog); await window.donna.goalsToggleMilestone(id, m); reopenGoals(id); }));
  main.querySelectorAll("[data-msdel]").forEach((b) => (b.onclick = async () => { const [id, m] = sp(b.dataset.msdel); await window.donna.goalsRemoveMilestone(id, m); reopenGoals(id); }));
  main.querySelectorAll("[data-addms]").forEach((el) => (el.onkeydown = async (e) => { if (e.key === "Enter" && el.value.trim()) { await window.donna.goalsAddMilestone(el.dataset.addms, el.value.trim()); reopenGoals(el.dataset.addms); } }));
  main.querySelectorAll("[data-week]").forEach((b) => (b.onclick = () => {
    const g = goals.find((x) => x.id === b.dataset.week);
    if (!g) return;
    openWeeklyCommitModal({ goal: g, onCommit: async (c, d) => { await window.donna.goalsSetWeek(b.dataset.week, c, d); reopenGoals(b.dataset.week); } });
  }));
  main.querySelectorAll("[data-gdone]").forEach((b) => (b.onclick = async () => { await window.donna.goalsUpdate(b.dataset.gdone, { done: true }); vGoals(); }));
  main.querySelectorAll("[data-greopen]").forEach((b) => (b.onclick = async () => { await window.donna.goalsUpdate(b.dataset.greopen, { done: false }); vGoals(); }));
  main.querySelectorAll("[data-gdel]").forEach((b) => (b.onclick = async () => { await window.donna.goalsRemove(b.dataset.gdel); vGoals(); toast("Deleted"); }));
  const ai = $("#cyc-ai");
  if (ai) ai.onclick = async (e) => {
    e.stopPropagation();
    ai.classList.add("loading");
    try {
      const summary = goals.filter((g) => !g.done).map((g) => `${g.objective} (${g.pct}%, week ${g.cycleWeek}/12, lead ${g.week?.done || 0}/${g.week?.committed || 0})`).join("; ");
      const r = await window.donna.askInternal(`quick: given my current goals [${summary}], where am I stuck? one sentence.`);
      showAiTip((r.answer || "No answer").replace(/^["']|["']$/g, "").trim());
    } catch (e) { showAiTip("Couldn't reach the brain — try again."); }
    finally { ai.classList.remove("loading"); }
  };
  openCoachButton("goals", {
    total: goals.length, active: goals.filter((g) => !g.done).length,
    domains: domains.map((d) => ({ d, n: activeCount(d) })),
    emptyDomains: empty,
    top: goals.slice(0, 3).map((g) => ({ o: g.objective, pct: g.pct })),
  });
}
// re-render Goals keeping the expanded card open
async function reopenGoals(id) { await vGoals(); const el = main.querySelector(`.goal2[data-id="${id}"]`); if (el) el.classList.add("open"); }

/* Content-idea bank — reel hooks/concepts, promote to a task when ready. */
async function vIdeas(root = main, bare = false) {
  const ideas = await window.donna.ideasList();
  stagger = 0;
  const live = ideas.filter((i) => !i.used).length;
  root.innerHTML = `${bare ? "" : `<div class="view"><h1 class="h1">Ideas</h1><p class="sub">Reel hooks & concepts — dump fast, promote to a task when it's time${ideas.length ? `<span class="sep">·</span>${live} live` : ""}</p>`}
    <div class="quick-add" style="margin-top:16px"><input id="idea-add" placeholder="New idea — a hook, a concept, then ↵"></div>
    ${ideas.length ? `<div class="idea-list">${ideas.map((i) => `
      <div class="idea-card ${i.used ? "used" : ""}" data-id="${i.id}">
        <div class="idea-text">${esc(i.text)}</div>
        <div class="idea-foot">
          ${i.niche ? `<span class="proj-chip" style="--h:330">${esc(i.niche)}</span>` : ""}
          <span class="spacer"></span>
          ${i.used ? `<span class="idea-used-tag">used ✓</span>` : `<button class="idea-btn" data-totask="${i.id}">→ task</button>`}
          <button class="idea-btn" data-toggle="${i.id}">${i.used ? "↺ revive" : "mark used"}</button>
          <button class="idea-del" data-idel="${i.id}">✕</button>
        </div>
      </div>`).join("")}</div>`
      : `<div class="rows" style="margin-top:14px"><div class="empty">No ideas yet. Dump reel hooks and concepts here the second they hit — then promote the good ones into tasks.</div></div>`}
  ${bare ? "" : "</div>"}`;
  const inp = $("#idea-add");
  inp.onkeydown = async (e) => { if (e.key === "Enter" && inp.value.trim()) { await window.donna.ideasAdd(inp.value.trim(), ""); inp.value = ""; vIdeas(root, bare); } };
  const find = (id) => ideas.find((x) => x.id === id);
  root.querySelectorAll("[data-totask]").forEach((b) => (b.onclick = async () => { await window.donna.addTask("Make reel: " + find(b.dataset.totask).text.slice(0, 60)); await window.donna.ideasUpdate(b.dataset.totask, { used: true }); await refresh(); vIdeas(root, bare); toast("Promoted to Tasks"); }));
  root.querySelectorAll("[data-toggle]").forEach((b) => (b.onclick = async () => { await window.donna.ideasUpdate(b.dataset.toggle, { used: !find(b.dataset.toggle).used }); vIdeas(root, bare); }));
  root.querySelectorAll("[data-idel]").forEach((b) => (b.onclick = async () => { await window.donna.ideasRemove(b.dataset.idel); vIdeas(root, bare); toast("Deleted"); }));
  if (!bare) openCoachButton("ideas", { tab: "ideas", total: ideas.length, live: ideas.filter((i) => !i.used).length });
}

/* Library — Capture + Notes + Ideas fused into one tabbed page (no more three
   near-identical nav items). Tabs, not scroll. */
let libTab = localStorage.getItem("donna.libTab") || "capture";
function vLibrary() {
  stagger = 0;
  main.innerHTML = `<div class="view">
    <div class="lib-head">
      <div><h1 class="h1">Library</h1><p class="sub">Everything you capture, keep, and dream up — in one place</p></div>
      <div class="seg lib-seg">
        <button data-lib="capture" class="${libTab === "capture" ? "on" : ""}">Capture</button>
        <button data-lib="notes" class="${libTab === "notes" ? "on" : ""}">Notes</button>
        <button data-lib="ideas" class="${libTab === "ideas" ? "on" : ""}">Ideas</button>
      </div>
    </div>
    <div id="lib-body"></div>
  </div>`;
  main.querySelector(".lib-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    libTab = b.dataset.lib; localStorage.setItem("donna.libTab", libTab); vLibrary();
  });
  const body = $("#lib-body");
  if (libTab === "notes") vNotes(body, true);
  else if (libTab === "ideas") vIdeas(body, true);
  else vCapture(body, true);
  openCoachButton("library", { tab: libTab });
}

/* Comms — channels in one place. Honest: shows real connection status + exactly
   what each needs; the message adapters light up once you complete each sign-in. */
async function vComms() {
  const channels = await window.donna.comms();
  stagger = 0;
  const gmail = channels.find((c) => c.id === "gmail");
  let unread = null;
  if (gmail && gmail.connected) { try { unread = await window.donna.gmailUnread(); } catch {} }
  const dchip = (d) => d === "easy" ? `<span class="cm-diff easy">easy · 1 sign-in</span>` : d === "medium" ? `<span class="cm-diff med">one-time setup</span>` : `<span class="cm-diff hard">fragile</span>`;
  main.innerHTML = `<div class="view">
    <h1 class="h1">Comms</h1>
    <p class="sub">Your channels in one place — connect each to surface what needs a reply</p>
    <div class="cm-list">${channels.map((c) => `
      <div class="cm-card">
        <div class="cm-icon" style="--h:${c.hue}">${esc(c.name[0])}</div>
        <div class="cm-body">
          <div class="cm-name">${esc(c.name)} ${c.connected ? `<span class="cm-on">● connected</span>` : dchip(c.difficulty)}</div>
          ${c.connected && c.id === "gmail" && unread && unread.ok
            ? `<div class="cm-need"><b style="color:var(--ink)">${unread.count} unread</b>${unread.items && unread.items.length ? " · " + esc(unread.items.slice(0, 2).map((m) => m.subject || m.from).join(" · ")).slice(0, 72) : ""}</div>`
            : `<div class="cm-need">${esc(c.need)}</div>`}
        </div>
        <button class="cm-btn ${c.connected ? "on" : ""}" data-connect="${c.id}">${c.connected ? "Connected" : "Connect"}</button>
      </div>`).join("")}</div>
    <p class="hint" style="margin-top:16px"><b>Gmail is real</b> — one Google sign-in and Donna reads your unread. Telegram/WhatsApp need their own sign-in (api_id+phone · QR). Nothing here is faked.</p>
  </div>`;
  main.querySelectorAll("[data-connect]").forEach((b) => (b.onclick = async () => {
    const id = b.dataset.connect;
    if (id === "gmail") {
      if (gmail.connected) return;
      toast("Opening Google sign-in in your browser…");
      const r = await window.donna.connectGmail();
      if (r && r.ok) { toast("Gmail connected ✓"); vComms(); } else { toast("Sign-in didn't complete — try again"); }
    } else {
      toast(id === "telegram" ? "Telegram — needs api_id/hash + a phone login (with you)" : "WhatsApp — scan a QR from Linked Devices (with you)");
    }
  }));
  openCoachButton("comms", { tab: "comms", channels: channels.map((c) => ({ n: c.name, on: c.connected })) });
}

/* Activity — the append-only log of everything you've done. "What did I do
   this week / this month / ever" answer in one screen, browsable by day, by
   type, by domain. The whole point is that nothing is lost — every completion,
   every weekly commit, every person touched, every note written. Time-grouped
   cards. Per-item icon reflects the source (task/goal/person/note/etc). */
const ACTIVITY_RANGES = [
  { k: "1d", label: "Today", days: 1 },
  { k: "7d", label: "7 days", days: 7 },
  { k: "30d", label: "30 days", days: 30 },
  { k: "90d", label: "90 days", days: 90 },
  { k: "all", label: "All time", days: null },
];
const ACTIVITY_TYPES = [
  { k: "task_done", label: "Tasks done", icon: "✓", hue: 145 },
  { k: "task_wontdo", label: "Won't do", icon: "⊘", hue: 25 },
  { k: "goal_added", label: "Goals added", icon: "◎", hue: 250 },
  { k: "goal_reached", label: "Goals hit", icon: "★", hue: 85 },
  { k: "goal_week", label: "Weekly commits", icon: "◷", hue: 250 },
  { k: "person_touched", label: "People", icon: "☎", hue: 25 },
  { k: "note_added", label: "Notes", icon: "✎", hue: 200 },
  { k: "idea_added", label: "Ideas", icon: "✦", hue: 330 },
];
let actRange = localStorage.getItem("donna.actRange") || "30d";
let actDomains = []; // empty = all
let actTypes = [];   // empty = all

function vActivity() {
  stagger = 0;
  const range = ACTIVITY_RANGES.find((r) => r.k === actRange) || ACTIVITY_RANGES[2];
  const since = range.days ? Date.now() - range.days * 86400000 : null;
  main.innerHTML = `<div class="view wide">
    <div class="lib-head">
      <div><h1 class="h1">Activity</h1><p class="sub">Everything you've done — append-only, browsable${range.days ? `<span class="sep">·</span>last ${range.days}d` : `<span class="sep">·</span>all time`}</p></div>
      <div class="seg vz-seg">
        ${ACTIVITY_RANGES.map((r) => `<button data-arange="${r.k}" class="${actRange === r.k ? "on" : ""}">${r.label}</button>`).join("")}
      </div>
    </div>
    <div class="act-filters">
      <div class="act-domains">
        ${["work", "money", "health", "relationships"].map((d) => `<button class="act-dom ${actDomains.includes(d) ? "on" : ""}" data-ardom="${d}">${d}</button>`).join("")}
      </div>
      <div class="act-types">
        ${ACTIVITY_TYPES.map((t) => `<button class="act-type ${actTypes.includes(t.k) ? "on" : ""}" data-artype="${t.k}" style="--h:${t.hue}"><i>${t.icon}</i>${t.label}</button>`).join("")}
        <button class="act-clear ${(actDomains.length || actTypes.length) ? "on" : ""}" data-arclear>clear</button>
      </div>
    </div>
    <div id="act-body"></div>
  </div>`;
  wireActivity();
  paintActivity(since);
  openCoachButton("activity", { range: actRange, days: range.days, filters: { domains: actDomains, types: actTypes } });
}

function wireActivity() {
  main.querySelector(".vz-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    actRange = b.dataset.arange; localStorage.setItem("donna.actRange", actRange);
    vActivity();
  });
  main.querySelectorAll("[data-ardom]").forEach((b) => (b.onclick = () => {
    const d = b.dataset.ardom;
    actDomains = actDomains.includes(d) ? actDomains.filter((x) => x !== d) : [...actDomains, d];
    vActivity();
  }));
  main.querySelectorAll("[data-artype]").forEach((b) => (b.onclick = () => {
    const t = b.dataset.artype;
    actTypes = actTypes.includes(t) ? actTypes.filter((x) => x !== t) : [...actTypes, t];
    vActivity();
  }));
  main.querySelector("[data-arclear]")?.addEventListener("click", () => { actDomains = []; actTypes = []; vActivity(); });
}

async function paintActivity(since) {
  const opts = { since, kinds: actTypes.length ? actTypes : null, domains: actDomains.length ? actDomains : null };
  const groups = await window.donna.activityGrouped(opts);
  const slot = $("#act-body");
  if (!slot) return;
  if (!groups.length) {
    slot.innerHTML = `<div class="rows" style="margin-top:14px"><div class="empty">Nothing in this range yet. Complete a task, log a weekly commit, or add a note — it'll land here.</div></div>`;
    return;
  }
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  slot.innerHTML = `<div class="act-stats">${total} events across ${groups.length} day${groups.length !== 1 ? "s" : ""}</div>
    <div class="act-timeline">${groups.map(activityDayHtml).join("")}</div>`;
}

function activityDayHtml({ day, items }) {
  const d = new Date(day + "T12:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const label = day === today ? "Today" : day === yest ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return `<div class="act-day">
    <div class="act-day-head">${label}<span class="act-day-n">${items.length}</span></div>
    ${items.map(activityItemHtml).join("")}
  </div>`;
}

function activityItemHtml(e) {
  const meta = ACTIVITY_TYPES.find((t) => t.k === e.kind) || { icon: "·", hue: 200 };
  const time = new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `<div class="act-item" style="--h:${meta.hue}"><span class="act-icon">${meta.icon}</span><span class="act-time">${time}</span><span class="act-text">${esc(e.summary)}</span></div>`;
}

/* Log — decision log + anti-goals. Two columns, calm. The decision log
   captures "what did I decide and why" so you can defend it later.
   Anti-goals are hard guardrails: things you'll NEVER do. */
let logTab = localStorage.getItem("donna.logTab") || "decisions";
async function vLog() {
  const [decisions, antigos] = await Promise.all([
    window.donna.decisionsList(),
    window.donna.antigoalsList(),
  ]);
  const tab = logTab;
  main.innerHTML = `<div class="view wide">
    <div class="lib-head">
      <div><h1 class="h1">Log</h1>
      <p class="sub">Decisions you've made and guardrails you'll keep</p></div>
      <div class="seg log-seg">
        <button data-log="decisions" class="${tab === "decisions" ? "on" : ""}">Decisions<span class="log-count">${decisions.length}</span></button>
        <button data-log="antigoals" class="${tab === "antigoals" ? "on" : ""}">Anti-goals<span class="log-count">${antigos.length}</span></button>
      </div>
    </div>
    <div id="log-body"></div>
  </div>`;
  const body = $("#log-body");
  if (tab === "antigoals") {
    body.innerHTML = antigos.length ? antigos.map((a) => `<div class="ag-row">
      <div class="ag-rule">${esc(a.rule)}</div>
      <div class="ag-why">${a.why ? esc(a.why) : ""}</div>
      <div class="ag-foot"><span>added ${new Date(a.at).toLocaleDateString()}</span><button class="ag-x" data-ag-rm="${a.id}">✕</button></div>
    </div>`).join("") + `<div class="quick-add" style="margin-top:14px"><input id="ag-rule" placeholder='Rule — "no lipsync to old voice"'><input id="ag-why" placeholder="Why (optional)" style="margin-top:6px"><button class="hero-btn go" id="ag-add" style="margin-top:8px">Add guardrail</button></div>`
      : `<div class="empty">No anti-goals yet. Anti-goals are the things you'll NEVER do — the hard guardrails that keep you honest. Add your first one below.</div>
      <div class="quick-add" style="margin-top:14px"><input id="ag-rule" placeholder='Rule — "no lipsync to old voice"'><input id="ag-why" placeholder="Why (optional)" style="margin-top:6px"><button class="hero-btn go" id="ag-add" style="margin-top:8px">Add guardrail</button></div>`;
    body.querySelector("#ag-add").onclick = async () => {
      const rule = body.querySelector("#ag-rule").value.trim();
      const why = body.querySelector("#ag-why").value.trim();
      if (!rule) return;
      await window.donna.antigoalsAdd({ rule, why });
      toast("Guardrail added");
      vLog();
    };
    body.querySelectorAll("[data-ag-rm]").forEach((b) => (b.onclick = async () => { await window.donna.antigoalsRemove(b.dataset.agRm); vLog(); }));
  } else {
    body.innerHTML = decisions.length ? decisions.map((d) => `<div class="dec-row">
      <div class="dec-t">${esc(d.title)}</div>
      ${d.why ? `<div class="dec-why"><b>Why:</b> ${esc(d.why)}</div>` : ""}
      ${d.alternatives ? `<div class="dec-alt"><b>Alternatives:</b> ${esc(d.alternatives)}</div>` : ""}
      ${d.who ? `<div class="dec-who"><b>Who knows:</b> ${esc(d.who)}</div>` : ""}
      <div class="dec-foot"><span>${new Date(d.at).toLocaleDateString()}${d.status && d.status !== "active" ? ` · ${d.status}` : ""}</span><button class="dec-x" data-dec-rm="${d.id}">✕</button></div>
    </div>`).join("") + `<div class="quick-add" style="margin-top:14px"><input id="dec-title" placeholder='Decision — "switched to veo3 fast from kling"'><textarea id="dec-why" placeholder="Why (the one-line reason)" style="margin-top:6px;min-height:48px;width:100%;font:inherit"></textarea><input id="dec-alt" placeholder="Alternatives considered (optional)" style="margin-top:6px"><input id="dec-who" placeholder="Who knows (optional)" style="margin-top:6px"><button class="hero-btn go" id="dec-add" style="margin-top:8px">Log decision</button></div>`
      : `<div class="empty">No decisions logged yet. "Why did I switch from X to Y?" — the answer is here. Log your first decision below.</div>
      <div class="quick-add" style="margin-top:14px"><input id="dec-title" placeholder='Decision — "switched to veo3 fast from kling"'><textarea id="dec-why" placeholder="Why (the one-line reason)" style="margin-top:6px;min-height:48px;width:100%;font:inherit"></textarea><input id="dec-alt" placeholder="Alternatives considered (optional)" style="margin-top:6px"><input id="dec-who" placeholder="Who knows (optional)" style="margin-top:6px"><button class="hero-btn go" id="dec-add" style="margin-top:8px">Log decision</button></div>`;
    body.querySelector("#dec-add").onclick = async () => {
      const title = body.querySelector("#dec-title").value.trim();
      const why = body.querySelector("#dec-why").value.trim();
      const alt = body.querySelector("#dec-alt").value.trim();
      const who = body.querySelector("#dec-who").value.trim();
      if (!title) return;
      await window.donna.decisionsAdd({ title, why, alternatives: alt, who });
      toast("Decision logged");
      vLog();
    };
    body.querySelectorAll("[data-dec-rm]").forEach((b) => (b.onclick = async () => { await window.donna.decisionsRemove(b.dataset.decRm); vLog(); }));
  }
  main.querySelector(".log-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    logTab = b.dataset.log; localStorage.setItem("donna.logTab", logTab);
    vLog();
  });
  /* Add coach button */
  const coachData = { tab: logTab, decisions: decisions.length, antigos: antigos.length };
  try { openCoachButton("log", coachData); } catch {}
}

/* Forecast — 3-week capacity heatmap. Days as columns, hours committed
   vs capacity. Color-coded by load. Saturday/Sunday are lighter capacity.
   Click a day to see the tasks due. Built with array-push (no nested
   template literals) to stay corruption-proof. */
async function vPlanForecast() {
  stagger = 0;
  const cap = await window.donna.capacity();
  const days = (cap && cap.days) || [];
  const capacity = (cap && cap.capacity) || 6;
  const weeks = [days.slice(0, 7), days.slice(7, 14), days.slice(14, 21)];
  const totalDue = days.reduce(function (n, d) { return n + (d.due ? d.due.length : 0); }, 0);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const tone = function (pct) { return pct === 0 ? "fc-light" : pct < 60 ? "fc-ok" : pct < 100 ? "fc-warn" : "fc-over"; };

  const h = [];
  h.push('<div class="view wide">');
  h.push('<div class="pl-topbar">');
  h.push('<div><h1 class="h1">Plan</h1><p class="sub">' + totalDue + ' tasks due over 3 weeks &middot; ' + capacity + 'h/day capacity</p></div>');
  h.push('<div class="seg pl-seg">');
  h.push('<button data-planlay="timeline">Timeline</button>');
  h.push('<button data-planlay="week">Week</button>');
  h.push('<button class="on" data-planlay="forecast">Forecast</button>');
  h.push('</div></div>');

  h.push('<div class="fc-wrap">');
  for (let w = 0; w < weeks.length; w++) {
    const week = weeks[w];
    if (!week.length) continue;
    h.push('<div class="fc-week"><div class="fc-week-lbl">' + (w === 0 ? "This week" : w === 1 ? "Next week" : "In 2 weeks") + '</div><div class="fc-row">');
    for (let i = 0; i < week.length; i++) {
      const d = week[i];
      const dt = new Date(d.date + "T00:00:00");
      const dueCount = d.due ? d.due.length : 0;
      const barPct = Math.min(100, d.pct);
      h.push('<button class="fc-day ' + tone(d.pct) + (d.isWeekend ? " fc-weekend" : "") + '" data-fcday="' + d.date + '" title="' + esc(String(d.loadHrs).slice(0, 4)) + 'h of ' + d.effHours + 'h">');
      h.push('<span class="fc-dow">' + DOW[d.dow] + '</span>');
      h.push('<span class="fc-date">' + dt.getDate() + '</span>');
      h.push('<span class="fc-bar"><span class="fc-fill" style="height:' + barPct + '%"></span></span>');
      h.push('<span class="fc-pct">' + d.pct + '%</span>');
      h.push(dueCount ? '<span class="fc-count">' + dueCount + '</span>' : '<span class="fc-count fc-empty">&middot;</span>');
      h.push('</button>');
    }
    h.push('</div></div>');
  }
  h.push('</div>');
  h.push('<p class="hint" style="margin-top:14px">Bars show committed load vs your daily capacity. Amber = near full, red = overbooked. Click a day to see its tasks.</p>');
  h.push('</div>');
  main.innerHTML = h.join("");

  main.querySelectorAll("[data-planlay]").forEach(function (b) {
    b.onclick = function () { planLayout = b.dataset.planlay; localStorage.setItem("donna.planLayout", planLayout); vPlan(); };
  });
  main.querySelectorAll("[data-fcday]").forEach(function (b) {
    b.onclick = function () {
      const date = b.dataset.fcday;
      const day = days.find(function (x) { return x.date === date; });
      if (!day || !day.due || !day.due.length) { toast("Nothing due " + date); return; }
      openForecastDay(day);
    };
  });
  openCoachButton("plan", { layout: "forecast", totalDue: totalDue, capacity: capacity, days: days.length });
}

/* Popover listing the tasks due on a clicked forecast day. */
function openForecastDay(day) {
  closePop && closePop();
  const rows = day.due.map(function (t) {
    return '<div class="fcd-row"><span class="fcd-pri p' + t.pri + '">P' + t.pri + '</span><span class="fcd-title">' + esc(t.title) + '</span><span class="fcd-min">' + t.min + 'm</span></div>';
  }).join("");
  const el = document.createElement("div");
  el.className = "fcd-modal";
  el.innerHTML = '<div class="fcd-card"><div class="fcd-head">' + day.date + ' &middot; ' + day.due.length + ' task' + (day.due.length === 1 ? "" : "s") + ' &middot; ' + String(day.loadHrs).slice(0, 4) + 'h</div>' + rows + '<button class="fcd-close">Close</button></div>';
  document.body.appendChild(el);
  const close = function () { el.remove(); };
  el.querySelector(".fcd-close").onclick = close;
  el.onclick = function (e) { if (e.target === el) close(); };
}
