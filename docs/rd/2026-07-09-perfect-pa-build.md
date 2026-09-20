# Donna — Build plan: perfect PA, July 2026

Per Alex's brief: "make this the perfect personal assistant app, ask
questions, outperform any competitor, be creative, no bollocks."

## Direction (locked in via Q&A)

- **All four rounds** (A Today OS / B Entities+planning / C Memory+briefing /
  D Polish) — every one is green-lit. Build in order, ship each before next.
- **Anticipatory mode** — Donna acts without being asked where it's safe.
- **Connect, don't replace** Trello / Hubstaff / agency dashboard. Read from
  them, surface alerts, deep-link in. Donna is the front door.
- **Three window modes** redesigned: each gets its own card system, user-
  configurable, smart by context.
- **Minimax M3 as the AI default** for everything, Opus for Ask only.
  Already wired; will extend `brain.suggest()` to every surface.
- **herdr context**: Donna polls the agency OS API + dashboard state file
  every 30s; surfaces "World Cup lane is idle" / "George just shipped X" as
  Today cards.
- **George wait-timer**: stale at 12h, alert at 48h. Partner-tight.
- **Friday Briefing**: executive voice, week-over-week diff + goal scorecard
  + numbers + insight + coach paragraph. Auto-written Fri 4pm.
- **Earn only when running** — no SaaS subscriptions, no new dependencies.

## Build sequence

### Round A — Today OS (this conversation)
- [x] Lead action strip on Today (done)
- [x] Activity view (done)
- [ ] Smart Today: time-of-day aware "Up Next" intelligence
- [ ] Won't-do modal (replace prompt() in shell.js:258)
- [ ] Weekly-commit modal in Goals (replace prompt() in views-pages.js:656)
- [ ] Multi-select on Tasks (bulk done/snooze/priority)
- [ ] Week-at-a-glance strip on Today (cycleWeek + lead-measure)
- [ ] Three-mode redesign: card config + smart per-mode

### Round B — Entities + planning
- [ ] Project Kanban: board by #project (Trello-killer surface, but read-only)
- [ ] Goal templates: 12-week OKR / habit-stack (one-click add)
- [ ] Recurring tasks (daily/weekly templates that regenerate)
- [ ] 12-Week Cycle UI on Goals (cycleStart + cycleWeek)
- [ ] Daily Note auto-create at 5am
- [ ] Asset/media library: search across all your files

### Round C — Memory + briefing
- [ ] Friday Briefing auto-doc (Fri 4pm, executive voice, AI-written)
- [ ] Ask threads with memory
- [ ] Backlinks (Roam-style) across entities
- [ ] Decision log
- [ ] Anti-goal tracker
- [ ] Subscription audit

### Round D — Polish + integration
- [ ] Boot diagnostic card
- [ ] Forecast view (3-week capacity heatmap)
- [ ] George wait-timer (12h/48h)
- [ ] Apple Health read (sleep → Today)
- [ ] Google Calendar read into Plan
- [ ] Markdown export per surface
- [ ] Focus mode (auto-mute notifs in deep work)
- [ ] Pattern-of-the-day recognizer
- [ ] Interruption cost counter
- [ ] Mini-CRM upgrade on People

## AI everywhere

- [ ] `brain.suggest({ surface, payload })` helper — minimax by default,
      routes by intent. Used by: Today up-next, Goals coach, Tasks re-prio,
      People drift draft, Activity weekly digest, Library auto-tagger,
      weekly briefing, all modal prompts.
- [ ] Every view gets a per-page AI button (✦) — context-aware, costs only
      a single minimax call.

## Money controls (permanent)

- [ ] No SaaS subscriptions, no paid APIs
- [ ] Minimax M3 for everything except Ask (Opus/Fable optional)
- [ ] No Higgsfield/ElevenLabs/credit-spending without explicit approval
- [ ] No edits to /Applications/Donna.app launcher (local source IS live)
- [ ] No edits to /Users/cam/Desktop/ALJ-HOME/UGC/node_modules (WORLD owns)
- [ ] All commits grouped, screenshot-verified per logical chunk
- [ ] /Applications/Donna.app reads /Users/cam/Desktop/ALJ-HOME/donna-v2
      — local edits are live. `npm start` to test; `bash scripts/build-app.sh`
      only needed for icon/codesign rebuilds.
