/* views-notes2.js — Notes rebuild layer (loaded after views-pages.js so this
   `notesDesk` wins). A real knowledge desk: tags, wiki-link backlinks
   (in and out), daily notes, duplicate/export, live word count, AI actions.
   Backend: src/lib/notes.js + the existing backlinks index. */

/* a pending autosave captures the editor instance AND the note id at the moment
   of typing, so switching notes (or navigating away) can never write one note's
   HTML into another. flushNotesNow() is called before every re-render/unload. */
let _notesPending = null;
function flushNotesNow() {
  if (!_notesPending) return;
  const { id, inst, title } = _notesPending;
  _notesPending = null;
  clearTimeout(_notesSave);
  try { window.donna.notesUpdate(id, { title: String(title || "Untitled").slice(0, 140), body: inst.root.innerHTML.slice(0, 200000) }); } catch {}
}
if (!window.__notesUnloadHooked) {
  window.__notesUnloadHooked = true;
  window.addEventListener("beforeunload", flushNotesNow);
}

async function notesDesk(root) {
  const notes = await window.donna.notesList();
  let tagIndex = [];
  try { tagIndex = await window.donna.ext("notes", "allTags"); } catch {}
  const q = (localStorage.getItem("donna.noteSearch") || "").toLowerCase();
  const tagFilter = localStorage.getItem("donna.noteTag") || "";
  const shown = notes
    .filter((n) => !q || ((n.title || "") + " " + _stripHtml(n.body)).toLowerCase().includes(q))
    .filter((n) => !tagFilter || (Array.isArray(n.tags) ? n.tags : []).includes(tagFilter))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const active = shown.find((n) => n.id === _notesActive) || shown[0] || null;
  _notesActive = active ? active.id : null;
  const activeTags = active && Array.isArray(active.tags) ? active.tags : [];

  root.innerHTML = `<div class="notes-desk">
    <aside class="notes-list">
      <div class="notes-list-head">
        <input id="nd-search" class="nd-search" placeholder="Search notes" value="${esc(localStorage.getItem("donna.noteSearch") || "")}">
        <button class="nd-new" id="nd-new" title="New note">＋</button>
      </div>
      <div class="nd-subhead">
        <button class="nd-daily" id="nd-daily" title="Open today's daily note">☀ Daily</button>
        ${tagIndex.length ? `<select id="nd-tagfilter" class="nd-tagfilter"><option value="">All tags</option>${tagIndex.map((t) => `<option value="${esc(t.tag)}"${tagFilter === t.tag ? " selected" : ""}>${esc(t.tag)} · ${t.count}</option>`).join("")}</select>` : ""}
      </div>
      <div class="notes-rows">
        ${shown.length ? shown.map((n) => `<button class="notes-row ${n.id === _notesActive ? "on" : ""}" data-note="${n.id}">
          <span class="nr-title">${n.pinned ? "★ " : ""}${esc(n.title || "Untitled")}</span>
          <span class="nr-sub">${esc(_stripHtml(n.body).slice(0, 70) || "No additional text")}</span>
          <span class="nr-date">${new Date(n.updatedAt || n.createdAt || Date.now()).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
          ${(Array.isArray(n.tags) && n.tags.length) ? `<span class="nr-tags">${n.tags.slice(0, 3).map((t) => `<i style="--h:${tagHue(t)}">${esc(t)}</i>`).join("")}</span>` : ""}
        </button>`).join("") : `<div class="empty" style="padding:18px 12px">${tagFilter || q ? "No notes match." : "No notes yet — hit ＋."}</div>`}
      </div>
    </aside>
    <section class="notes-editor">
      ${active ? `
      <input id="nd-title" class="nd-title" placeholder="Title" value="${esc(active.title || "")}">
      <div class="nd-tags" id="nd-tags"></div>
      <div id="nd-quill" class="nd-quill"></div>
      <div class="nd-links" id="nd-links"></div>
      <div class="nd-foot">
        <button class="nd-act" data-act="pin">${active.pinned ? "★ Pinned" : "☆ Pin"}</button>
        <button class="nd-act" data-act="tidy">✨ Tidy</button>
        <button class="nd-act" data-act="summary">Summarise</button>
        <button class="nd-act" data-act="tasks">→ Tasks</button>
        <button class="nd-act" data-act="dup">Duplicate</button>
        <button class="nd-act" data-act="copy">Copy .md</button>
        <span class="nd-spacer"></span>
        <span class="nd-count" id="nd-count"></span>
        <button class="nd-act danger" data-act="del">Delete</button>
      </div>` : `<div class="empty" style="margin:auto">Select a note, or create one.</div>`}
    </section>
  </div>`;

  const ns = root.querySelector("#nd-search");
  let noteSearchT = null;
  if (ns) ns.oninput = () => {
    localStorage.setItem("donna.noteSearch", ns.value);
    /* debounce so the editor/Quill instance isn't rebuilt on every keystroke */
    clearTimeout(noteSearchT);
    noteSearchT = setTimeout(() => {
      notesDesk(root);
      const el = root.querySelector("#nd-search");
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 180);
  };
  const tf = root.querySelector("#nd-tagfilter");
  if (tf) tf.onchange = () => { if (tf.value) localStorage.setItem("donna.noteTag", tf.value); else localStorage.removeItem("donna.noteTag"); notesDesk(root); };
  root.querySelector("#nd-new").onclick = async () => { flushNotesNow(); const id = await window.donna.notesAdd("Untitled", ""); _notesActive = id; notesDesk(root); };
  const daily = root.querySelector("#nd-daily");
  if (daily) daily.onclick = async () => { flushNotesNow(); const n = await window.donna.notesDaily(); _notesActive = n && n.id; notesDesk(root); toast("Today's note"); };
  root.querySelectorAll("[data-note]").forEach((b) => (b.onclick = () => { flushNotesNow(); _notesActive = b.dataset.note; notesDesk(root); }));

  if (!active) return;

  if (_quill && _quill.__root !== root) { try { _quill = null; } catch {} }
  const host = root.querySelector("#nd-quill");
  _quill = new Quill(host, {
    theme: "snow",
    placeholder: "Start writing…  [[Note Title]] links notes · #tags in the rail above",
    modules: { toolbar: [["bold", "italic", "underline", "strike"], [{ header: [1, 2, 3, false] }], [{ list: "ordered" }, { list: "bullet" }, { list: "check" }], ["blockquote", "code-block", "link"], ["clean"]] },
  });
  _quill.__root = root;
  let initial = active.body || "";
  if (!_noteIsHtml(initial)) { initial = _mdToHtml(initial); try { window.donna.notesUpdate(active.id, { body: initial }); } catch {} }
  _quill.clipboard.dangerouslyPasteHTML(initial);

  /* ── tags ── */
  const tagsWrap = root.querySelector("#nd-tags");
  let tags = activeTags.slice();
  const renderTags = () => {
    tagsWrap.innerHTML = tags.map((t, i) => `<span class="nd-tag" style="--h:${tagHue(t)}">${esc(t)}<button data-trm="${i}" aria-label="Remove tag">×</button></span>`).join("")
      + `<input id="nd-tag-in" class="nd-tag-in" placeholder="add tag">`;
    tagsWrap.querySelectorAll("[data-trm]").forEach((b) => (b.onclick = async () => { tags.splice(+b.dataset.trm, 1); await window.donna.ext("notes", "setTags", active.id, tags); renderTags(); }));
    const inpT = tagsWrap.querySelector("#nd-tag-in");
    inpT.onkeydown = async (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const v = inpT.value.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-");
      if (v && !tags.includes(v) && tags.length < 12) tags.push(v);
      inpT.value = "";
      await window.donna.ext("notes", "setTags", active.id, tags);
      renderTags();
    };
  };
  renderTags();

  /* ── word count ── */
  const updateCount = () => {
    const words = _quill.getText().trim().split(/\s+/).filter(Boolean).length;
    const c = root.querySelector("#nd-count");
    if (c) c.textContent = `${words} word${words === 1 ? "" : "s"} · ${Math.max(1, Math.round(words / 200))} min read`;
  };
  updateCount();

  const save = () => {
    clearTimeout(_notesSave);
    const inst = _quill;
    const noteId = active.id;
    _notesPending = { id: noteId, inst, title: (root.querySelector("#nd-title") || {}).value || "Untitled" };
    _notesSave = setTimeout(async () => {
      const p = _notesPending; _notesPending = null;
      if (!p || !p.inst) return;
      try {
        await window.donna.notesUpdate(p.id, { title: String(p.title || "Untitled").slice(0, 140), body: p.inst.root.innerHTML.slice(0, 200000) });
        if (p.inst === _quill) {
          const row = root.querySelector(`[data-note="${p.id}"] .nr-sub`);
          if (row) row.textContent = _stripHtml(p.inst.getText()).slice(0, 70) || "No additional text";
          const tr = root.querySelector(`[data-note="${p.id}"] .nr-title`);
          if (tr) tr.textContent = p.title || "Untitled";
          updateCount();
          renderLinks().catch(() => {});
        }
      } catch {}
    }, 500);
  };
  _quill.on("text-change", save);
  const titleEl = root.querySelector("#nd-title"); if (titleEl) titleEl.oninput = save;

  /* ── wiki-link backlinks (out + in) ── */
  const linksWrap = root.querySelector("#nd-links");
  const openEntity = (kind, id) => {
    if (kind === "note") { flushNotesNow(); _notesActive = id; notesDesk(root); }
    else if (kind === "task") { if (typeof openTaskDetail === "function") openTaskDetail(id); }
    else if (kind === "goal") gotoView("goals");
  };
  async function renderLinks() {
    if (!document.body.contains(linksWrap)) return;
    const incoming = await window.donna.backlinksFor({ kind: "note", id: active.id }).catch(() => []);
    const bodyText = _stripHtml(_quill.root.innerHTML);
    const outNames = [...new Set([...bodyText.matchAll(/\[\[([^\]\n]{1,80})\]\]/g)].map((m) => m[1].trim()))];
    const outChips = outNames.map((name) => {
      const target = notes.find((n) => String(n.title || "").toLowerCase() === name.toLowerCase());
      return target ? `<button class="nd-link" data-lk-note="${esc(target.id)}">[[${esc(name)}]]</button>` : `<span class="nd-link dead">[[${esc(name)}]]</span>`;
    }).join("");
    const inChips = incoming.map((b) => `<button class="nd-link" data-lk-kind="${esc(b.kind)}" data-lk-id="${esc(b.id)}">${esc(b.kind)} · ${esc(trunc(b.label || "", 40))}</button>`).join("");
    linksWrap.innerHTML = (outNames.length || incoming.length) ? `
      ${outChips ? `<div class="nd-link-row"><span class="nd-link-h">Links to</span>${outChips}</div>` : ""}
      ${inChips ? `<div class="nd-link-row"><span class="nd-link-h">Linked from</span>${inChips}</div>` : ""}` : "";
    linksWrap.querySelectorAll("[data-lk-note]").forEach((b) => (b.onclick = () => openEntity("note", b.dataset.lkNote)));
    linksWrap.querySelectorAll("[data-lk-kind]").forEach((b) => (b.onclick = () => openEntity(b.dataset.lkKind, b.dataset.lkId)));
  }
  renderLinks().catch(() => {});

  /* ── actions ── */
  root.querySelectorAll("[data-act]").forEach((b) => (b.onclick = async () => {
    const act = b.dataset.act;
    const body = _quill.getText().slice(0, 4000);
    if (act === "pin") { await window.donna.notesUpdate(active.id, { pinned: !active.pinned }); notesDesk(root); return; }
    if (act === "del") { if (confirm("Delete this note?")) { await window.donna.notesRemove(active.id); _notesActive = null; notesDesk(root); } return; }
    if (act === "dup") { const id = await window.donna.ext("notes", "duplicate", active.id); _notesActive = id || _notesActive; notesDesk(root); toast("Duplicated"); return; }
    if (act === "copy") {
      const md = `# ${active.title || "Untitled"}\n\n${_quill.getText().trim()}\n`;
      try { await navigator.clipboard.writeText(md); toast("Markdown copied"); } catch { toast("Couldn't copy"); }
      return;
    }
    if (act === "tidy") {
      b.textContent = "…";
      const r = await window.donna.askInternal(`quick: Tidy and structure the following note as clean HTML suitable for a rich-text editor. Keep the author's wording and facts; invent nothing. Return ONLY the HTML.\n\n${body}`);
      const out = (r.answer || "").trim();
      if (out && !/^\(/i.test(out)) { _quill.clipboard.dangerouslyPasteHTML(out); save(); toast("Tidied"); }
      else toast("Couldn't tidy that one");
      b.textContent = "✨ Tidy"; return;
    }
    if (act === "summary") {
      b.textContent = "…";
      const r = await window.donna.askInternal(`quick: In 2-3 sentences, summarise this note. Just the summary.\n\n${body}`);
      const out = (r.answer || "").trim();
      if (out && !/^\(/i.test(out)) { _quill.clipboard.dangerouslyPasteHTML(`<blockquote>${out.replace(/[<>]/g, "")}</blockquote><p><br></p>` + _quill.root.innerHTML); save(); toast("Summarised"); }
      else toast("Couldn't summarise");
      b.textContent = "Summarise"; return;
    }
    if (act === "tasks") {
      b.textContent = "…";
      const r = await window.donna.askInternal(`quick: Extract the concrete action items from this note as a plain list, one per line, no numbering, no preamble. If none, reply NONE.\n\n${body}`);
      const out = (r.answer || "").trim();
      if (out && !/^\(/i.test(out) && out.toUpperCase() !== "NONE") {
        const lines = out.split("\n").map((l) => l.replace(/^[-*•\d.\s]+/, "").trim()).filter((l) => l.length > 2).slice(0, 12);
        for (const l of lines) { try { await window.donna.addTask(l); } catch {} }
        toast(`Added ${lines.length} task${lines.length === 1 ? "" : "s"}`);
      } else toast("No action items found");
      b.textContent = "→ Tasks"; return;
    }
  }));
}
