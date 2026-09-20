/* nlparse.js — ONE natural-language task grammar, span-aware.
   Used by main (tasks.add) AND the renderer (live token highlighting), so what
   you see marked is exactly what gets parsed — never two parsers drifting.
   Loaded as CommonJS in main and as a plain <script> in the renderer.

   Grammar (Todoist × Akiflow, kept honest):
     dates      today · tomorrow/tmrw · in 3 days · friday / next friday
     time       3pm · at 15:30  (kept as dueTime for reminders/plan)
     priority   p1 p2 p3 · urgent/high/low
     estimate   =45m · =2h
     project    #project
     area       @work @money @health @relationships
     deadline   !friday · !tomorrow  (the drop-dead date — HARD by definition)
     bucket     tonight/this evening · someday · anytime
     waiting    waiting on sam
   Anything inside "double quotes" is literal — the escape hatch when the
   parser grabs a word you meant as title text. */

const NL_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const NL_AREAS = ["work", "money", "health", "relationships"];

function nlIso(d) { return d.toISOString().slice(0, 10); }
function nlDateFrom(word, base) {
  const today = base ? new Date(base) : new Date();
  const w = word.toLowerCase();
  if (w === "today" || w === "tonight") return nlIso(today);
  if (w === "tomorrow" || w === "tmrw") { const d = new Date(today); d.setDate(d.getDate() + 1); return nlIso(d); }
  const dayIdx = NL_DAYS.indexOf(w.replace(/^next\s+/, ""));
  if (dayIdx >= 0) {
    const d = new Date(today);
    let diff = (dayIdx - d.getDay() + 7) % 7; if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff); return nlIso(d);
  }
  const inM = w.match(/^in (\d+) days?$/);
  if (inM) { const d = new Date(today); d.setDate(d.getDate() + Number(inM[1])); return nlIso(d); }
  return null;
}

/* All token patterns, matched against the ORIGINAL string so every token
   carries its [i0,i1) span for the highlighter. Longest/most-specific first. */
const NL_RULES = [
  { kind: "estimate", re: /=\s?(\d+)\s?(m|min|h|hr)s?\b/gi },
  { kind: "deadline", re: /!(today|tomorrow|tmrw|in \d+ days?|(?:next )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/gi },
  { kind: "waiting", re: /\bwaiting(?:\s+on)?\s+([a-z0-9_]+)/gi },
  { kind: "date", re: /\b(in \d+ days?|(?:next )(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/gi },
  { kind: "date", re: /\b(today|tomorrow|tmrw|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi },
  { kind: "time", re: /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi },
  { kind: "time", re: /\bat\s+(\d{1,2}):(\d{2})\b/gi },
  { kind: "bucket", re: /\b(tonight|this evening|someday|anytime)\b/gi },
  { kind: "goal", re: />>\s*([a-z0-9][a-z0-9_-]*(?:\s+[a-z0-9_-]+)*)/gi },
  { kind: "priority", re: /\b(p[123]|urgent|high|low)\b/gi },
  { kind: "project", re: /#([a-z0-9_-]+)/gi },
  { kind: "area", re: /@(work|money|health|relationships|rel)\b/gi },
];

function nlTokenize(input) {
  const src = String(input || "");
  const tokens = [];
  const taken = new Array(src.length).fill(false);
  // literal spans: "quoted text" is never tokenized (the visible, reversible escape hatch)
  const literals = [];
  src.replace(/"([^"]*)"/g, (m, _1, i) => { literals.push([i, i + m.length]); return m; });
  const inLiteral = (i0, i1) => literals.some(([a, b]) => i0 >= a && i1 <= b);

  for (const rule of NL_RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(src))) {
      const i0 = m.index, i1 = m.index + m[0].length;
      if (inLiteral(i0, i1)) continue;
      let clash = false;
      for (let i = i0; i < i1; i++) if (taken[i]) { clash = true; break; }
      if (clash) continue;
      for (let i = i0; i < i1; i++) taken[i] = true;
      tokens.push({ kind: rule.kind, i0, i1, raw: m[0], m: [...m] });
    }
  }
  tokens.sort((a, b) => a.i0 - b.i0);

  /* fold tokens into the parsed task */
  const parsed = {
    title: "", dueAt: null, dueTime: null, deadline: null, deadlineHard: false,
    priority: 2, estimatedMinutes: null, bucket: null, area: null,
    project_id: null, waitingOn: null,
    objectiveId: null, objectiveNeedle: null, // `>>needle` → resolved to a goal id by tasks.add
  };
  const labels = [];
  for (const t of tokens) {
    if (t.kind === "estimate") {
      parsed.estimatedMinutes = Number(t.m[1]) * (/h/i.test(t.m[2]) ? 60 : 1);
      labels.push({ kind: t.kind, label: parsed.estimatedMinutes >= 60 ? `${parsed.estimatedMinutes / 60}h` : `${parsed.estimatedMinutes}m` });
    } else if (t.kind === "deadline") {
      parsed.deadline = nlDateFrom(t.m[1]); parsed.deadlineHard = true;
      labels.push({ kind: t.kind, label: `deadline ${t.m[1].toLowerCase()}` });
    } else if (t.kind === "date") {
      parsed.dueAt = nlDateFrom(t.m[1]);
      labels.push({ kind: t.kind, label: t.m[1].toLowerCase() });
    } else if (t.kind === "time") {
      let h = Number(t.m[1]); const min = Number(t.m[2] || 0); const ap = (t.m[3] || "").toLowerCase();
      if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
      parsed.dueTime = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      labels.push({ kind: t.kind, label: parsed.dueTime });
    } else if (t.kind === "bucket") {
      const w = t.m[1].toLowerCase();
      parsed.bucket = w === "tonight" || w === "this evening" ? "evening" : w;
      labels.push({ kind: t.kind, label: parsed.bucket });
    } else if (t.kind === "priority") {
      const w = t.m[1].toLowerCase();
      parsed.priority = w[0] === "p" ? Number(w[1]) : /urgent|high/.test(w) ? 1 : 3;
      labels.push({ kind: t.kind, label: `P${parsed.priority}` });
    } else if (t.kind === "project") {
      parsed.project_id = t.m[1].toLowerCase();
      labels.push({ kind: t.kind, label: `#${parsed.project_id}` });
    } else if (t.kind === "goal") {
      parsed.objectiveNeedle = t.m[1].trim().toLowerCase();
      labels.push({ kind: t.kind, label: `→ ${parsed.objectiveNeedle}` });
    } else if (t.kind === "area") {
      const a = t.m[1].toLowerCase();
      parsed.area = a === "rel" ? "relationships" : a;
      labels.push({ kind: t.kind, label: `@${parsed.area}` });
    } else if (t.kind === "waiting") {
      parsed.waitingOn = t.m[1].toLowerCase();
      labels.push({ kind: t.kind, label: `⧗ ${parsed.waitingOn}` });
    }
  }
  if (parsed.bucket === "evening" && !parsed.dueAt) parsed.dueAt = nlIso(new Date());

  /* title = source minus tokens, quotes unwrapped, whitespace collapsed */
  let title = "";
  for (let i = 0; i < src.length; i++) if (!taken[i]) title += src[i];
  parsed.title = title.replace(/"/g, "").replace(/\s{2,}/g, " ").trim();

  return { tokens, parsed, labels };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { nlTokenize, nlDateFrom, NL_AREAS };
}
// Goal-link kind is renderer-highlighted too (main + renderer share the rules).
if (typeof window !== "undefined" && window.nlTokenize) {/* renderer already loaded it */}
