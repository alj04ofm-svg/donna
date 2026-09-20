/* quick-capture window logic — text in, token marks live, context chip
   attaches where you were (click it to detach), Enter saves, Esc vanishes. */
const inp = document.getElementById("in");
const mirror = document.getElementById("mirror");
const ctxBtn = document.getElementById("ctx");
const savedEl = document.getElementById("saved");
let ctx = null, ctxOn = true;

const esc_ = (s) => (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

window.donna.onCaptureCtx((c) => {
  ctx = c; ctxOn = !!c;
  paintCtx();
  inp.value = ""; mirror.innerHTML = ""; savedEl.style.display = "none";
  setTimeout(() => inp.focus(), 30);
});

function paintCtx() {
  if (!ctx) { ctxBtn.className = "ctx"; return; }
  ctxBtn.className = "ctx on" + (ctxOn ? "" : " off");
  ctxBtn.innerHTML = `☍ <b>${esc_(ctx.app)}</b>${ctx.title ? " — " + esc_(String(ctx.title).slice(0, 48)) : ""}`;
  ctxBtn.title = ctx.url || ctx.app;
}
ctxBtn.onclick = () => { ctxOn = !ctxOn; paintCtx(); inp.focus(); };

inp.addEventListener("input", () => {
  const v = inp.value;
  if (!v.trim()) { mirror.innerHTML = ""; return; }
  const { tokens } = nlTokenize(v);
  let html = "", pos = 0;
  for (const t of tokens) { html += esc_(v.slice(pos, t.i0)) + `<mark class="tk-${t.kind}">${esc_(v.slice(t.i0, t.i1))}</mark>`; pos = t.i1; }
  mirror.innerHTML = html + esc_(v.slice(pos));
  mirror.scrollLeft = inp.scrollLeft;
});
inp.addEventListener("scroll", () => (mirror.scrollLeft = inp.scrollLeft));

inp.addEventListener("keydown", async (e) => {
  if (e.key === "Escape") { window.donna.captureHide(); return; }
  if (e.key !== "Enter" || !inp.value.trim()) return;
  let text = inp.value.trim();
  const detail = ctxOn && ctx ? `from ${ctx.app}${ctx.title ? ` — ${ctx.title}` : ""}${ctx.url ? `\n${ctx.url}` : ""}` : "";
  if (/^note\s*[:\-]/i.test(text)) {
    await window.donna.ask(detail ? `${text}\n(${detail})` : text); // note: routes to the capture store
  } else {
    await window.donna.quickAdd(text.replace(/^(todo|task)\s*[:\-]\s*/i, ""), detail);
  }
  inp.value = ""; mirror.innerHTML = "";
  savedEl.style.display = "inline";
  setTimeout(() => window.donna.captureHide(), 420);
});
