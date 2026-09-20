/* Canvas — an edgeless spatial board (AFFiNE / Miro), local-first. Boards are
   tabs; each holds free-floating cards positioned in world space, so the board
   pans and zooms while cards keep their place. Design read: dark-tech thinking
   surface, low variance, restrained motion, airy density. */

let cvData = null;      // { boards: [...] }
let cvBoard = null;     // current board object
let cvPan = { x: 0, y: 0 };
let cvZoom = 1;
let cvSel = null;       // selected card id
let cvSaveT = null;

const CARD_HUES = { signal: 250, amber: 85, green: 160, rose: 25, plain: 0 };

function cvSave() { // debounced — boards are small, but drags fire fast
  clearTimeout(cvSaveT);
  cvSaveT = setTimeout(() => { if (cvBoard) window.donna.canvasSaveBoard(cvBoard); }, 350);
}

async function vCanvas() {
  cvData = await window.donna.canvasGet();
  if (!cvBoard || !cvData.boards.find((b) => b.id === cvBoard.id)) cvBoard = cvData.boards[0];
  else cvBoard = cvData.boards.find((b) => b.id === cvBoard.id);
  paintCanvas();
}

function paintCanvas() {
  main.innerHTML = `<div class="view wide cv-view">
    <div class="cv-topbar">
      <div class="cv-tabs">
        ${cvData.boards.map((b) => `<button class="cv-tab ${b.id === cvBoard.id ? "on" : ""}" data-board="${b.id}" data-name="${esc(b.name)}">${esc(b.name)}</button>`).join("")}
        <button class="cv-tab cv-tab-add" id="cv-add-board" title="New board">+</button>
      </div>
      <div class="cv-tools">
        <span class="cv-hint">double-click to add · drag to pan · scroll to zoom</span>
        <button class="cv-zbtn" id="cv-zout">−</button>
        <span class="cv-zlabel" id="cv-zlabel">${Math.round(cvZoom * 100)}%</span>
        <button class="cv-zbtn" id="cv-zin">+</button>
        <button class="cv-zbtn" id="cv-zreset" title="Reset view">⤢</button>
        ${cvData.boards.length > 1 ? `<button class="cv-zbtn cv-del-board" id="cv-del-board" title="Delete this board">✕</button>` : ""}
      </div>
    </div>
    <div class="cv-viewport" id="cv-viewport">
      <div class="cv-world" id="cv-world"></div>
      ${!cvBoard.cards.length ? `<div class="cv-empty">Empty board — double-click anywhere to drop your first card.</div>` : ""}
    </div>
  </div>`;
  renderCards();
  wireCanvas();
  openCoachButton("library", { tab: "canvas", board: cvBoard?.name, cards: cvBoard?.cards?.length || 0 });
}

function renderCards() {
  const world = $("#cv-world");
  if (!world) return;
  world.style.transform = `translate(${cvPan.x}px, ${cvPan.y}px) scale(${cvZoom})`;
  world.innerHTML = cvBoard.cards.map((c) => `
    <div class="cv-card ${cvSel === c.id ? "sel" : ""}" data-card="${c.id}" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;min-height:${c.h}px;--h:${CARD_HUES[c.color] ?? 250};${(CARD_HUES[c.color] ?? 250) === 0 ? "--plain:1;" : ""}">
      <div class="cv-card-text" contenteditable="true" spellcheck="false" data-cardtext="${c.id}">${esc(c.text)}</div>
      ${cvSel === c.id ? `<div class="cv-card-bar">
        ${Object.keys(CARD_HUES).map((k) => `<button class="cv-swatch ${c.color === k ? "on" : ""}" data-color="${c.id}|${k}" style="--h:${CARD_HUES[k]};${CARD_HUES[k] === 0 ? "--plain:1;" : ""}"></button>`).join("")}
        <button class="cv-card-task" data-totask="${c.id}" title="Promote to a task">→ task</button>
        <button class="cv-card-del" data-delcard="${c.id}">delete</button>
      </div>` : ""}
      ${cvSel === c.id ? `<div class="cv-resize" data-resize="${c.id}"></div>` : ""}
    </div>`).join("");
  wireCards();
}

function wireCanvas() {
  const vp = $("#cv-viewport"), world = $("#cv-world");
  // board tabs
  main.querySelectorAll("[data-board]").forEach((b) => {
    b.onclick = () => { cvBoard = cvData.boards.find((x) => x.id === b.dataset.board); cvSel = null; paintCanvas(); };
    b.ondblclick = async () => { const n = prompt("Rename board:", b.dataset.name); if (n && n.trim()) { await window.donna.canvasRenameBoard(b.dataset.board, n.trim()); vCanvas(); } };
  });
  $("#cv-add-board").onclick = async () => { const n = prompt("New board name:", "Board"); if (n === null) return; const id = await window.donna.canvasAddBoard(n.trim() || "Board"); cvData = await window.donna.canvasGet(); cvBoard = cvData.boards.find((x) => x.id === id); cvPan = { x: 0, y: 0 }; cvZoom = 1; paintCanvas(); };
  const del = $("#cv-del-board"); if (del) del.onclick = async () => { if (!confirm(`Delete board "${cvBoard.name}"?`)) return; const nid = await window.donna.canvasRemoveBoard(cvBoard.id); cvData = await window.donna.canvasGet(); cvBoard = cvData.boards.find((x) => x.id === nid) || cvData.boards[0]; paintCanvas(); };
  // zoom controls
  $("#cv-zin").onclick = () => setZoom(cvZoom * 1.2);
  $("#cv-zout").onclick = () => setZoom(cvZoom / 1.2);
  $("#cv-zreset").onclick = () => { cvZoom = 1; cvPan = { x: 0, y: 0 }; renderCards(); $("#cv-zlabel").textContent = "100%"; };

  // pan by dragging empty space
  vp.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".cv-card")) return;
    if (cvSel) { cvSel = null; renderCards(); }
    const sx = e.clientX, sy = e.clientY, ox = cvPan.x, oy = cvPan.y;
    vp.classList.add("panning");
    const move = (ev) => { cvPan.x = ox + (ev.clientX - sx); cvPan.y = oy + (ev.clientY - sy); world.style.transform = `translate(${cvPan.x}px, ${cvPan.y}px) scale(${cvZoom})`; };
    const up = () => { vp.classList.remove("panning"); document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  });
  // zoom toward cursor with wheel
  vp.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = vp.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const wx = (mx - cvPan.x) / cvZoom, wy = (my - cvPan.y) / cvZoom;
    const nz = Math.max(0.3, Math.min(2.5, cvZoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    cvPan.x = mx - wx * nz; cvPan.y = my - wy * nz; cvZoom = nz;
    world.style.transform = `translate(${cvPan.x}px, ${cvPan.y}px) scale(${cvZoom})`;
    const zl = $("#cv-zlabel"); if (zl) zl.textContent = Math.round(cvZoom * 100) + "%";
  }, { passive: false });
  // double-click empty → new card at that world point
  vp.addEventListener("dblclick", (e) => {
    if (e.target.closest(".cv-card")) return;
    const r = vp.getBoundingClientRect();
    const wx = (e.clientX - r.left - cvPan.x) / cvZoom - 100, wy = (e.clientY - r.top - cvPan.y) / cvZoom - 40;
    const c = { id: `c_${Date.now()}`, x: Math.round(wx), y: Math.round(wy), w: 210, h: 84, color: "signal", text: "" };
    cvBoard.cards.push(c); cvSel = c.id; cvSave();
    renderCards();
    setTimeout(() => { const el = document.querySelector(`[data-cardtext="${c.id}"]`); if (el) { el.focus(); } }, 20);
  });
}

function setZoom(z) {
  const vp = $("#cv-viewport"); if (!vp) return;
  const r = vp.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2;
  const wx = (cx - cvPan.x) / cvZoom, wy = (cy - cvPan.y) / cvZoom;
  cvZoom = Math.max(0.3, Math.min(2.5, z));
  cvPan.x = cx - wx * cvZoom; cvPan.y = cy - wy * cvZoom;
  renderCards();
  const zl = $("#cv-zlabel"); if (zl) zl.textContent = Math.round(cvZoom * 100) + "%";
}

function wireCards() {
  main.querySelectorAll(".cv-card").forEach((el) => {
    const id = el.dataset.card;
    // select + drag (from card body, not while editing text)
    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".cv-card-bar")) return;
      if (e.target.isContentEditable && cvSel === id) return; // let text editing happen
      if (cvSel !== id) { cvSel = id; renderCards(); }
      const card = cvBoard.cards.find((c) => c.id === id);
      const sx = e.clientX, sy = e.clientY, ox = card.x, oy = card.y;
      let moved = false;
      const move = (ev) => {
        const dx = (ev.clientX - sx) / cvZoom, dy = (ev.clientY - sy) / cvZoom;
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) moved = true;
        card.x = Math.round(ox + dx); card.y = Math.round(oy + dy);
        const node = document.querySelector(`.cv-card[data-card="${id}"]`);
        if (node) { node.style.left = card.x + "px"; node.style.top = card.y + "px"; }
      };
      const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); if (moved) cvSave(); };
      document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
    });
  });
  // inline text edit
  main.querySelectorAll("[data-cardtext]").forEach((el) => {
    el.onblur = () => { const c = cvBoard.cards.find((x) => x.id === el.dataset.cardtext); if (c) { c.text = el.innerText.slice(0, 600); cvSave(); } };
  });
  // color swatches
  main.querySelectorAll("[data-color]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const [id, k] = b.dataset.color.split("|");
    const c = cvBoard.cards.find((x) => x.id === id); if (c) { c.color = k; cvSave(); renderCards(); }
  }));
  // delete
  main.querySelectorAll("[data-delcard]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    cvBoard.cards = cvBoard.cards.filter((x) => x.id !== b.dataset.delcard); cvSel = null; cvSave(); renderCards();
    if (!cvBoard.cards.length) paintCanvas();
  }));
  // promote to a real task — the canvas is a thinking surface, not a dead end
  main.querySelectorAll("[data-totask]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const c = cvBoard.cards.find((x) => x.id === b.dataset.totask); if (!c || !c.text.trim()) return;
    await window.donna.addTask(c.text.trim().slice(0, 120));
    await refresh();
    toast("Promoted to Tasks");
  }));
  // resize from the bottom-right handle — cards were fixed-size before
  main.querySelectorAll("[data-resize]").forEach((h) => {
    h.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const id = h.dataset.resize;
      const c = cvBoard.cards.find((x) => x.id === id);
      const sx = e.clientX, sy = e.clientY, ow = c.w, oh = c.h;
      const move = (ev) => {
        c.w = Math.max(140, Math.round(ow + (ev.clientX - sx) / cvZoom));
        c.h = Math.max(56, Math.round(oh + (ev.clientY - sy) / cvZoom));
        const node = document.querySelector(`.cv-card[data-card="${id}"]`);
        if (node) { node.style.width = c.w + "px"; node.style.minHeight = c.h + "px"; }
      };
      const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); cvSave(); };
      document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
    });
  });
}
