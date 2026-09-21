/* ═══════════════════════════════════════════════════════════════════════════
   Tables — Airtable/Sheets-style grids, local and private. Import from
   CSV / TSV / Excel / Airtable exports (via SheetJS). NocoDB can be linked
   for a full database engine.
   ═══════════════════════════════════════════════════════════════════════════ */
let _tblActive = null;

async function vTables() {
  stagger = 0;
  const tables = await window.donna.tablesList();
  const activeId = tables.find((t) => t.id === _tblActive) ? _tblActive : (tables[0] && tables[0].id);
  _tblActive = activeId;
  const active = activeId ? await window.donna.tablesGet(activeId) : null;

  main.innerHTML = `<div class="view wide">
    <header class="tbl-head">
      <div>
        <div class="tbl-eyebrow">Database</div>
        <h1 class="h1">Tables</h1>
        <p class="sub">${tables.length ? `${tables.length} table${tables.length === 1 ? "" : "s"} · stored on this Mac` : "Your Airtable / Sheets, privately on your Mac"}</p>
      </div>
      <div class="tbl-head-acts">
        <button class="t2-btn ghost" id="tbl-nocodb">◧ NocoDB</button>
        <button class="t2-btn ghost" id="tbl-import">⬆ Import CSV / Excel</button>
        <button class="t2-btn primary" id="tbl-new">＋ New table</button>
      </div>
    </header>

    <div class="tbl-desk">
      <aside class="tbl-list">
        <div class="tbl-list-head">Your tables</div>
        <div class="tbl-rows">
          ${tables.length ? tables.map((t) => `<button class="tbl-row ${t.id === activeId ? "on" : ""}" data-tbl="${t.id}">
            <span class="tbl-row-name">${esc(t.name)}</span>
            <span class="tbl-row-meta">${t.rows} × ${t.cols}</span>
          </button>`).join("") : `<div class="tbl-empty-list">No tables yet.</div>`}
        </div>
      </aside>

      <section class="tbl-main" id="tbl-main">
        ${active ? renderTable(active) : `
          <div class="tbl-blank">
            <div class="tbl-blank-art">▦</div>
            <h2>No tables yet</h2>
            <p>Import a CSV or Excel file (Airtable and Google Sheets both export to these), or start a blank table.</p>
            <div class="tbl-blank-acts">
              <button class="t2-btn primary" id="tbl-blank-import">Import a file</button>
              <button class="t2-btn ghost" id="tbl-blank-new">Blank table</button>
            </div>
          </div>`}
      </section>
    </div>
  </div>`;

  // ── wiring ────────────────────────────────────────────────────────────────
  main.querySelectorAll("[data-tbl]").forEach((b) => (b.onclick = () => { _tblActive = b.dataset.tbl; vTables(); }));
  const doImport = async () => {
    let files = [];
    try { files = await window.donna.importSheet(); } catch {}
    if (!files || !files.length) return;
    let made = 0;
    for (const f of files) {
      try {
        const wb = XLSX.read(f.base64, { type: "base64" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
        const id = await window.donna.tablesImport(f.name.replace(/\.[^.]+$/, ""), matrix);
        if (id) { made++; _tblActive = id; }
      } catch {}
    }
    if (made) { toast(`Imported ${made} table${made === 1 ? "" : "s"}`); vTables(); }
    else toast("Couldn't read that file");
  };
  const doNew = async () => { const id = await window.donna.tablesCreate("Untitled table"); _tblActive = id; vTables(); };
  const h = (id, fn) => { const el = main.querySelector(id); if (el) el.onclick = fn; };
  h("#tbl-import", doImport); h("#tbl-new", doNew);
  h("#tbl-blank-import", doImport); h("#tbl-blank-new", doNew);
  h("#tbl-nocodb", async () => {
    const url = (cfg && cfg.nocodbUrl) || "";
    if (!url) { toast("Set your NocoDB URL in Settings → Behaviour"); return; }
    try { await window.donna.openExternal(url); } catch {}
  });

  if (!active) { openCoachButton("tables", { tables: 0 }); return; }

  // table rename
  const nameEl = main.querySelector("#tbl-name");
  if (nameEl) nameEl.onblur = async () => { await window.donna.tablesRename(active.id, nameEl.value.trim() || active.name); vTables(); };
  // cell edits
  main.querySelectorAll("[data-cell]").forEach((td) => (td.onblur = async () => {
    const [ri, key] = td.dataset.cell.split("|");
    await window.donna.tablesSetCell(active.id, Number(ri), key, td.textContent.trim());
  }));
  // add row / column / delete table
  h("#tbl-addrow", async () => { await window.donna.tablesAddRow(active.id, {}); vTables(); });
  h("#tbl-addcol", async () => {
    const name = (prompt("New column name:") || "").trim();
    if (name) { await window.donna.tablesAddColumn(active.id, name); vTables(); }
  });
  h("#tbl-delete", async () => { if (confirm(`Delete “${active.name}”?`)) { await window.donna.tablesRemove(active.id); _tblActive = null; vTables(); } });
  main.querySelectorAll("[data-delrow]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    await window.donna.tablesRemoveRow(active.id, Number(b.dataset.delrow)); vTables();
  }));
  openCoachButton("tables", { table: active.name, rows: active.rows.length, cols: active.columns.length });
}

function renderTable(t) {
  const cols = t.columns.length ? t.columns : [{ key: "name", name: "Name" }];
  return `<div class="tbl-wrap">
    <div class="tbl-topbar">
      <input id="tbl-name" class="tbl-name" value="${esc(t.name)}" title="Rename table">
      <span class="tbl-count">${t.rows.length} rows · ${cols.length} cols</span>
      <div class="tbl-topacts">
        <button class="t2-btn ghost" id="tbl-addrow">＋ Row</button>
        <button class="t2-btn ghost" id="tbl-addcol">＋ Column</button>
        <button class="t2-btn ghost danger" id="tbl-delete">Delete</button>
      </div>
    </div>
    <div class="tbl-scroll">
      <table class="tbl">
        <thead><tr><th class="tbl-idx"></th>${cols.map((c) => `<th>${esc(c.name)}</th>`).join("")}<th class="tbl-addcolcell"></th></tr></thead>
        <tbody>
          ${t.rows.length ? t.rows.map((r, ri) => `<tr>
            <td class="tbl-idx">${ri + 1}<button class="tbl-delrow" data-delrow="${ri}" title="Delete row">×</button></td>
            ${cols.map((c) => `<td contenteditable="true" data-cell="${ri}|${c.key}" spellcheck="false">${esc(r[c.key] ?? "")}</td>`).join("")}
            <td></td>
          </tr>`).join("") : `<tr><td class="tbl-idx"></td>${cols.map(() => `<td></td>`).join("")}<td></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}
