
function vProduction() {
  stagger = 0;
  const p = prod;
  const fr = p && p.freshness;
  main.innerHTML = `<div class="view wide">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
      <div><h1 class="h1">Production</h1>
      <p class="sub">Live operation state — via the dashboard bridge${p ? `<span class="sep">·</span>${p.perfected} perfected scripts` : ""}</p></div>
      <button class="triage-btn" data-dash="">Agency OS ↗</button>
    </div>
    ${fr ? `<div class="prod-status">
      <span class="ps ${p.live ? "ok" : "warn"}">${p.live ? "live" : "files only · bridge down"}</span>
      <span class="ps ${fr.dashboardUp ? "ok" : "warn"}">dashboard ${fr.dashboardUp ? "up" : "down"}</span>
      ${!fr.dashboardUp ? `<button class="wind-btn" id="prod-daststart" style="width:auto;margin:0;padding:4px 10px">▸ Start dashboard</button>` : ""}
      ${fr.editing ? `<span class="ps">editing · ${esc(fr.editing.current_stage || "—")}${fr.editing.grade ? " · " + esc(String(fr.editing.grade)) : ""}</span>` : ""}
      ${fr.stale ? `<span class="ps warn">⚠ ready count ${fr.readyAsOf ? Math.round(fr.readyAsOf.age_hours) + "h old" : "stale"} — regen pending</span>` : ""}
    </div>` : ""}
    ${!p ? '<div class="rows" style="margin-top:20px"><div class="empty">Reading pipeline…</div></div>' : `
    <div class="stage-strip">
      ${p.stages.map((s, i) => `
        <div class="stage ${s.alert ? "alert" : ""}"${si()}>
          <div class="stage-n">${s.n}</div>
          <div class="stage-label">${s.label}</div>
          <div class="stage-detail">${esc(s.detail)}</div>
        </div>${i < p.stages.length - 1 ? '<svg class="stage-arrow" viewBox="0 0 16 16"><path d="M5 3l5 5-5 5"/></svg>' : ""}`).join("")}
    </div>
    ${p.voiceFiles.length ? `<div class="sec" style="color:var(--p2)">Voice-swap gate — <b>blocking post</b></div>
      <div class="rows">${p.voiceFiles.map((f) => `<div class="row"${si()}><div class="row-body"><div class="row-title">${esc(f)}</div></div>
      <div class="row-meta"><span class="chip p2">needs voice</span></div></div>`).join("")}</div>` : ""}
    ${p.agents && p.agents.length ? `<div class="sec">Agents — <b>live in herdr</b></div>
      <div class="rows">${p.agents.map((a) => `<div class="row">
        <span class="ag-dot ${a.status}" style="margin-top:5px"></span>
        <div class="row-body"><div class="row-title">${esc(a.name)}</div></div>
        <div class="row-meta"><span class="ag-status">${esc(a.status)}</span></div></div>`).join("")}</div>` : ""}
    ${p.accounts.length ? `<div class="sec">Post-ready packs</div>
      <table class="qtable">${p.accounts.map((a) => `<tr><td>${esc(a.account)}</td><td style="text-align:right;font-family:var(--mono);color:var(--signal)">${a.count}</td></tr>`).join("")}</table>` : ""}
    `}
  </div>`;
  main.querySelectorAll("[data-dash]").forEach((b) => (b.onclick = () => window.donna.dashOpen(b.dataset.dash)));
  const ds = $("#prod-daststart"); if (ds) ds.onclick = async () => { ds.textContent = "Starting…"; ds.disabled = true; await window.donna.dashStart(); toast("Starting Agency OS…"); setTimeout(() => refreshProd().then(() => { if (view === "production") vProduction(); }), 4000); };
  if (!p || !p.agents) refreshProd().then(() => { if (view === "production") render(); });
  openCoachButton("production", p ? {
    live: p.live,
    stages: (p.stages || []).map((s) => ({ k: s.key, n: s.n, alert: !!s.alert })),
    voice: p.voiceFiles?.length || 0,
    accounts: (p.accounts || []).length,
    perfected: p.perfected,
  } : null);
}

/* ── Ask: grouped recommendations tailored to Alex's operation ── */
function suggGroups() {
  const top = data?.open?.slice().sort((a, b) => a.priority - b.priority)[0];
  const george = data?.open?.filter((t) => t.waitingOn === "george" || /george/i.test(t.title)).length;
  return [
    { label: "Work", icon: "◎", chips: [
      "What should I hit first today?",
      top ? `How do I knock out "${top.title.length > 38 ? top.title.slice(0, 34).replace(/\s+\S*$/, "") + "…" : top.title}"?` : "What's my highest-leverage move?",
      "What's blocking the pipeline right now?",
      george ? "Draft the message to George for my open items" : "What decisions are waiting on me?",
    ] },
    { label: "Content", icon: "✦", chips: [
      "best: 3 scroll-stop gossip hooks for Anastasia",
      "best: a punchy World Cup reel opener",
      "Ideas for the next reel batch",
      "best: rewrite a hook to hit harder",
    ] },
    { label: "Review", icon: "↺", chips: [
      "What shipped today?",
      "Summarize what the agents got done",
      "What's post-ready across my accounts?",
      "What did I decide this week?",
    ] },
    { label: "Plan", icon: "◷", chips: [
      "Plan my next 2 hours",
      "What can I knock out in 30 minutes?",
      "What should I NOT touch today?",
    ] },
  ];
}

/* Ask modes — quick/think/best used to be typed prefixes hidden in a hint
   line; Alex asked to make them real buttons. Clicking one tags the next
   send; the prefix strips back out of what's shown, brain.js still reads it. */
const ASK_MODES = [["quick", "⚡", "fast"], ["think", "◐", "deep"], ["best", "✦", "top creative"]];
let askMode = null;

/* rotating suggestion carousel — one flattened, shuffled-feeling list cycled
   on a timer; click to send straight away. Alex wanted this to feel alive,
   not a static chip wall. */
let askCarouselIdx = 0, askCarouselT = null;
function flatSuggestions() { return suggGroups().flatMap((g) => g.chips.map((c) => ({ c, icon: g.icon }))); }
function paintCarousel() {
  const el = $("#ask-carousel"); if (!el) return;
  const list = flatSuggestions(); if (!list.length) return;
  askCarouselIdx = askCarouselIdx % list.length;
  const item = list[askCarouselIdx];
  el.classList.remove("spin"); void el.offsetWidth; el.classList.add("spin");
  el.querySelector(".ask-car-icon").textContent = item.icon;
  el.querySelector(".ask-car-text").textContent = item.c.replace(/^(best|think|quick):\s*/, "");
  el.dataset.q = item.c;
}
function startCarousel() {
  clearInterval(askCarouselT);
  askCarouselT = setInterval(() => { askCarouselIdx++; paintCarousel(); }, 5000);
}

/* Ask — Donna's own AI hub. A left rail (new chat · jump-starts · what she
   knows about you) beside the conversation, an ambient aurora behind the orb.
   This is the "our own AI" centrepiece; Memory lives here now, as the panel
   that quietly learns about Alex so she can help better. */
function vAsk() {
  const g = suggGroups();
  const modeHtml = ASK_MODES.map(([k, ic, hint]) => `<button class="ask-mode ${askMode === k ? "on" : ""}" data-mode="${k}" title="${esc(hint)}">${ic} ${k}</button>`).join("");
  const empty = `<div class="ask-empty">
    <div class="ask-hero-orb"><span class="orb speaking"></span></div>
    <div class="ask-hi">${greeting()}, Alex.<br><span>What are we shipping?</span></div>
    <button class="ask-carousel" id="ask-carousel"><span class="ask-car-icon"></span><span class="ask-car-text"></span><span class="ask-car-go">↵</span></button>
  </div>`;
  main.innerHTML = `<div class="view ask-hub" style="max-width:none">
    <aside class="ask-rail">
      <button class="ask-new" id="ask-new"><span class="orb"></span> New chat</button>
      <div class="ask-rail-sec">Jump-starts</div>
      <div class="ask-jumps">
        ${g.map((grp) => `<div class="ask-jgroup"><div class="ask-jlabel">${grp.icon} ${grp.label}</div>${grp.chips.map((c) => `<button class="ask-jump" data-q="${esc(c)}">${esc(trunc(c.replace(/^(best|think|quick):\s*/, ""), 40))}</button>`).join("")}</div>`).join("")}
      </div>
      <div class="ask-rail-sec">What Donna knows about you</div>
      <div class="ask-about" id="ask-about"><div class="ask-about-loading">…</div></div>
      <div class="quick-add ask-teach"><input id="ask-teach" placeholder="Teach her something… ↵"></div>
    </aside>
    <div class="ask-main">
      <div class="ask-aura" id="ask-aura"><div class="ask-aura-cursor"></div></div>
      <div id="thread">${thread.length ? thread.map(msgHtml).join("") : empty}</div>
      <div id="askbar">
        <div class="ask-modes">${modeHtml}<span class="ask-mode-hint">↑ last</span></div>
        <div class="field"><span class="orb"></span><input id="ask-in" placeholder="Ask Donna anything…"></div>
      </div>
    </div>
  </div>`;
  const inp = $("#ask-in");
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && inp.value.trim()) { sendAsk(withMode(inp.value.trim())); inp.value = ""; histIdx = -1; }
    else if (e.key === "ArrowUp" && !inp.value) {
      if (askHistory.length) { histIdx = Math.min(histIdx + 1, askHistory.length - 1); inp.value = askHistory[askHistory.length - 1 - histIdx]; }
      e.preventDefault();
    } else if (e.key === "ArrowDown" && histIdx >= 0) {
      histIdx--; inp.value = histIdx < 0 ? "" : askHistory[askHistory.length - 1 - histIdx];
      e.preventDefault();
    }
  });
  main.querySelectorAll(".ask-jump").forEach((b) => (b.onclick = () => sendAsk(b.dataset.q)));
  main.querySelectorAll(".ask-mode").forEach((b) => (b.onclick = () => { askMode = askMode === b.dataset.mode ? null : b.dataset.mode; vAsk(); }));
  $("#ask-new").onclick = () => { thread.length = 0; vAsk(); };
  const teach = $("#ask-teach");
  teach.onkeydown = async (e) => { if (e.key === "Enter" && teach.value.trim()) { await window.donna.memoryAdd(teach.value.trim(), "fact"); teach.value = ""; try { snd.pop(); } catch {} loadAskAbout(); toast("Donna will remember that"); } };
  loadAskAbout();
  requestAnimationFrame(() => inp.focus());
  const th = $("#thread"); if (th) th.scrollTop = 1e6;
  const car = $("#ask-carousel");
  if (car) { paintCarousel(); startCarousel(); car.onclick = () => sendAsk(car.dataset.q); }
  else clearInterval(askCarouselT);
  const aura = $("#ask-aura");
  if (aura) main.querySelector(".ask-main").onmousemove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    aura.style.setProperty("--mx", `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
    aura.style.setProperty("--my", `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
  };
  /* the coach on Ask: free-text input lands directly in the thread; the two
     suggestion chips default to "summarize our last chat" / "what were we
     talking about?" — both routed through sendAsk so they join the thread. */
  openCoachButton("ask", {
    threadLen: thread.length,
    lastUser: [...thread].reverse().find((m) => m.role === "you")?.text?.slice(0, 220) || null,
  });
}
/* strip any existing mode prefix, then apply the active one — clicking a
   jump-start chip that already has its own best:/think: shouldn't get
   double-tagged by whatever mode button happens to be lit. */
function withMode(q) {
  const stripped = q.replace(/^(best|think|quick):\s*/i, "");
  return askMode ? `${askMode}: ${stripped}` : q;
}

/* the "about you" panel — Donna's live self-knowledge (was the Memory page) */
async function loadAskAbout() {
  const el = $("#ask-about"); if (!el) return;
  let facts = []; try { facts = await window.donna.memoryList(); } catch {}
  const KIND_H = { person: 25, preference: 250, date: 85, project: 330, health: 160, fact: 200 };
  el.innerHTML = facts.length
    ? facts.slice(0, 20).map((f) => `<div class="ask-fact"><span class="ask-fact-dot" style="--h:${KIND_H[f.kind] || 200}"></span><span class="ask-fact-t" title="${esc(f.source)} · ${new Date(f.createdAt).toLocaleDateString()}">${esc(f.fact)}</span><button class="ask-fact-x" data-forget="${f.id}">×</button></div>`).join("")
    : `<div class="ask-about-empty">Nothing yet. As you talk, Donna quietly remembers what matters — or teach her below.</div>`;
  el.querySelectorAll("[data-forget]").forEach((b) => (b.onclick = async () => { await window.donna.memoryRemove(b.dataset.forget); loadAskAbout(); }));
}

function msgHtml(m, i) {
  if (m.role === "you") return `<div class="msg you msg-in"><span class="msg-body">${esc(m.text)}</span></div>`;
  const body = m.streaming
    ? `<div class="thinking-line"><i></i><i></i><i></i></div>`
    : `${esc(m.text)}`;
  return `<div class="msg donna msg-in" data-i="${i}"><div class="msg-head"><span class="orb"></span><span class="msg-name">Donna</span>
    ${m.tier && m.tier !== "capture" ? `<span class="chip tier">${m.tier}</span>` : ""}</div>
    <div class="msg-body">${body}</div>
    ${!m.streaming && m.text ? `<div class="msg-acts"><button data-copy="${i}">Copy</button><button data-regen="${i}">Regenerate</button></div>` : ""}</div>`;
}

function paintThread() {
  const t = $("#thread"); if (!t) return;
  t.innerHTML = thread.map(msgHtml).join("");
  t.scrollTop = 1e6;
  t.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => { navigator.clipboard.writeText(thread[b.dataset.copy].text); toast("Copied"); }));
  t.querySelectorAll("[data-regen]").forEach((b) => (b.onclick = () => {
    const i = Number(b.dataset.regen);
    const prevUser = [...thread.slice(0, i)].reverse().find((m) => m.role === "you");
    if (prevUser) sendAsk(prevUser.text);
  }));
}

/* typewriter reveal — the answer arrives whole; stream it in at reading speed */
function typewrite(el, text, done) {
  let i = 0;
  const caret = '<span class="caret">▍</span>';
  const step = () => {
    i = Math.min(text.length, i + Math.max(2, Math.round(text.length / 90)));
    el.innerHTML = esc(text.slice(0, i)) + (i < text.length ? caret : "");
    if (i < text.length) setTimeout(step, 12);
    else done && done();
  };
  step();
}

async function sendAsk(q) {
  if (streaming) return;
  streaming = true;
  askHistory.push(q); if (askHistory.length > 40) askHistory.shift();
  localStorage.setItem("donna.askHistory", JSON.stringify(askHistory));
  thread.push({ role: "you", text: q });
  const reply = { role: "donna", text: "", tier: null, streaming: true };
  thread.push(reply);
  if (view === "ask") paintThread();
  const res = await window.donna.ask(q);
  reply.tier = res.tier;
  if (view === "ask") {
    const el = document.querySelector(".msg.donna:last-of-type .msg-body");
    if (el) {
      typewrite(el, res.answer, () => {
        reply.text = res.answer; reply.streaming = false; streaming = false;
        paintThread();
        // suggested follow-ups — one cheap minimax call to read the conversation
        // and offer 2-3 natural next moves. Falls back silently if the brain's down.
        if (res.answer && res.tier !== "capture") suggestFollowups();
      });
    } else { reply.text = res.answer; reply.streaming = false; streaming = false; }
  } else { reply.text = res.answer; reply.streaming = false; streaming = false; }
  if (res.tier === "capture") { await refresh(); renderCompactBody(); }
}

/* Cheap AI follow-up — minimax reads the last 2 turns and suggests 2-3 natural
   next moves. Rendered as a horizontal row of pill buttons under the message. */
async function suggestFollowups() {
  if (view !== "ask") return;
  const last = thread.filter((m) => !m.streaming).slice(-2);
  if (last.length < 2) return;
  const q = `Based on this short exchange, suggest 2-3 short follow-up questions Alex might naturally ask next. Reply ONLY as a JSON array of strings, no preamble, no quotes inside.\n\nUser: ${last[0].text}\nDonna: ${last[1].text}`;
  const out = await window.donna.askInternal(q);
  let arr = [];
  try { arr = JSON.parse((out.answer || "").match(/\[[\s\S]*\]/)?.[0] || "[]"); } catch {}
  if (!arr.length) return;
  const wrap = document.createElement("div");
  wrap.className = "msg-followups msg-in";
  wrap.innerHTML = arr.slice(0, 3).map((s) => `<button class="msg-followup">${esc(s)}</button>`).join("");
  const lastMsg = document.querySelector(".msg.donna:last-of-type");
  if (lastMsg) lastMsg.appendChild(wrap);
  wrap.querySelectorAll(".msg-followup").forEach((b) => (b.onclick = () => sendAsk(b.textContent)));
  const t = $("#thread"); if (t) t.scrollTop = 1e6;
}

async function vCapture(root = main, bare = false) {
  const caps = await window.donna.captures();
  stagger = 0;
  const rel = (iso) => { const d = (Date.now() - new Date(iso)) / 1000; if (d < 60) return "just now"; if (d < 3600) return Math.floor(d / 60) + "m ago"; if (d < 86400) return Math.floor(d / 3600) + "h ago"; return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }); };
  root.innerHTML = `${bare ? "" : `<div class="view"><h1 class="h1">Capture</h1><p class="sub">Get it out of your head — sort it later</p>`}
    <div class="cap-hero"><input id="cap-in" placeholder="Capture anything… ↵ to log it" autofocus></div>
    <div class="sec">Recent${caps.length ? `<span class="rh-avg">${caps.length}</span>` : ""}</div>
    ${caps.length ? `<div class="cap-stream">${caps.slice().reverse().map((c, i) => `
      <div class="cap-row"${si()} style="opacity:${Math.max(0.55, 1 - i * 0.03)}"><span class="cap-kind ${c.kind}">${esc(c.kind)}</span><span class="cap-text">${esc(c.text)}</span>
      <span class="cap-time">${rel(c.created_at)}</span></div>`).join("")}</div>`
      : `<div class="rows"><div class="empty">Everything you capture shows up here. Just start typing above.</div></div>`}
  ${bare ? "" : "</div>"}`;
  const ci = root.querySelector("#cap-in") || $("#cap-in");
  if (!ci) return; // detached (boot double-render race) — the live render wires it
  ci.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && ci.value.trim()) {
      let v = ci.value.trim();
      if (!/^(todo|note|task)\s*[:\-]/i.test(v) && !/^remind me/i.test(v)) v = "todo: " + v;
      ci.value = "";
      try { snd.pop(); } catch {}
      await window.donna.ask(v);
      vCapture(root, bare); toast("Captured");
    }
  });
  if (!bare) openCoachButton("capture", { total: caps.length, recent: caps.slice(0, 3).map((c) => c.text.slice(0, 40)) });
}
