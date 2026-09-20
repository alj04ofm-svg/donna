# Donna V2 — Level-Up Master Plan

**Date:** 2026-07-06 · **Status:** Approved direction (Alex's answers 2026-07-06) · **Research:** `docs/rd/2026-07-06-*.md` (3 syntheses: tasks/planning, time-tracking, AI-assistant/delight)

## Locked decisions (Alex)

1. **Scope:** Donna = personal OS + agency summary. Deep-linked both ways with Agency OS (`ofm-dashboard`, port 3200) — click a task/section in Donna → the exact dashboard section opens. Agency deep management stays in Agency OS.
2. **Tracking:** auto-track (app/window/idle, local-only) + manual task timers. The proper Hubstaff thing, framed as self-memory, never surveillance.
3. **Feel:** premium base (Linear/Things polish, sub-100ms, asymmetric timing) + earned delight moments (completion pops, streak fire, subtle synthesized sounds).
4. **Voice:** system first. No TTS work this round.

## Port map (verified 2026-07-06)

- `:8091` Donna Bridge (state_server.py) — spawned by Donna, proxies :3050
- `:3050` UGC ops dashboard — LIVE, `/api/health`, `/api/editing-status` (pipeline truth)
- `:3200` Agency OS (`ALJ-HOME/ofm-dashboard`, Next 16) — strategic dashboard; routes: analytics, chatters, comms, creative, ideas, models, money, notifications, pipeline, recruitment, settings, social, staff, swipe; APIs: ai, alerts, analytics, creative, data, import, integrations, overview, report, target. Not always running — Donna should detect + offer to start.

## Phases

### Phase 0 — Foundation (enables everything)
- **Renderer refactor**: split `app.js` (1650+ lines, will 3×) into modules loaded by `index.html` script tags: `core.js` (state, helpers, router, palette, keyboard), `views/*.js` (one per page), `motion.js` (animation system), `sound.js`. No bundler.
- **Motion system**: CSS custom-property spring curves (`--spring-pop: linear(0, 1.4 60%, 1)`), asymmetric timing convention (appear ≤80ms, exit ~150ms, nothing >300ms), staggered entrances capped at 10, `prefers-reduced-motion` global wrap, FLIP helper (~15 lines), WAAPI particle helper.
- **Sound kit**: Web Audio synthesized (no assets): 2-note tick (complete), warm chime (habit), rising 3-note (milestone), muted pop (capture). Fire at animation peak. Config toggle, low gain default.
- **Task model upgrade** (`tasks.js`, Donna-only fields harmless to shared store): `bucket` (today/anytime/someday/evening), `startDate` vs `deadline` + `deadlineHard`, `wontDo` status, `area` (work/money/health/relationships), `actualMinutes`, `objectiveId` (weekly objective link).

### Phase 1 — Capture + Tasks (steal the best of Things/Todoist/Linear/TickTick)
- **NL parser with live token highlighting**: mirror-div `<mark>` technique; parses dates ("tomorrow 3pm", "fri"), `p1-p3`, `#project`, `=2h`, `@area`, `!deadline`, recurring; visible "parsed as…" chips, one keystroke to revert.
- **Global quick capture**: second hotkey → floating capture pill; context autofill (frontmost app, browser URL/title via AppleScript) into task note.
- **Tasks page rebuild**: Today / This Evening / Anytime / Someday sections; deadline countdown badges; at-risk warning (est. work > free time before deadline); single-key actions on cursor row (E edit, P priority, D date, S someday, W waiting, V evening, 1/2/3 estimate 15m/30m/1h); Won't Do (with reason, distinct from done); logbook shows done + won't-do honestly.
- **Triage wizard**: card-by-card for inbox + overdue, four keys (T today / D pick date / S someday / X won't-do). Entry points: morning ritual step, Capture page, ⌘K.

### Phase 2 — Tracker: the proper Hubstaff thing (ActivityWatch × RescueTime × Rize × Hubstaff-minus-boss)
- **Heartbeat engine** (`tracker.js` rebuild): main-process 4s poll via `get-windows` (@rize-io fork) + `powerMonitor.getSystemIdleTime()`; merge identical `{app,title,url}` within 10s pulsetime into duration events; per-day JSON event log (~50KB/day); close events on suspend/lock; AFK >180s retroactive.
- **Categorization**: hierarchical rules (regex over app|title|domain), deepest match wins, ~30 defaults tuned to Alex (Higgsfield/cmux/herdr/Terminal→Agency Ops; IG/TikTok→Social; etc.), retroactive re-scoring, editable in Settings.
- **Scoring**: category levels −2..+2 → daily Pulse 0–100 (RescueTime formula); focus sessions (≥25min, one productive category ≥80%, <4 switches/10min); context switches/hr; longest block.
- **Tracker page rebuild**: hero = day timeline strip (colored by category, gray AFK, click block → evidence drawer with titles/URLs + nearest screenshots); score dial + deep-work + switches vs 7-day avg; top categories/apps with sparklines; uncategorized triage pile.
- **Task timers**: play/pause on any task accumulates `actualMinutes` (sessions.js already logs); planned vs actual per task/area.
- **Nudges (rationed)**: >20min continuous distracting; >90min continuous real work → break; all local notifications.
- **End-of-day AI recap**: events+stats → brain → 5-line honest narrative; shown in Shutdown + saved to journal.
- **Screenshots**: keep 10-min cadence, index to timeline, auto-delete >14 days, per-app blacklist.
- **Permissions onboarding**: checklist card driven by real API status; graceful app-only degradation.

### Phase 3 — Rituals + Plan (Sunsama × Structured × Reclaim)
- **Morning Plan wizard**: skippable-in-10s modal — (1) shutdown time, (2) triage cards, (3) pull Anytime→Today with estimate keys + live overcommit meter (planned vs available from calendar), (4) order. Sets 1–3 weekly objectives Monday.
- **Shutdown upgrade**: planned-vs-actual per task, time-by-area pie (real tracker data), carry-forward per task (tomorrow/date/someday/won't-do), day-close state + streak.
- **Weekly Review artifact**: generated page — time patterns, habit rates, wheel deltas, people contacted, objective hours vs total, resurfaced note/win ("On This Day"); monthly "Wrapped".
- **Plan page**: real-time now-line; drag tasks from rail onto timeline; named slots holding several tasks; **Replan** button with preview diff (never silent); habit defense blocks (flexible, harden as window closes, warn when impossible).

### Phase 4 — Memory + proactivity (Martin × Dot lessons)
- **`memory.js`**: structured fact store {id, fact, kind: person/preference/date/project/health, source, confidence, createdAt}; Memory page — visible, searchable, editable, deletable (trust = inspectability).
- **Ambient capture**: mine Ask conversations for facts; inline "remembered ✓" glint on capture.
- **Brief upgrade**: memory callbacks (never fabricate; low confidence = silent), one-tap actions on every brief item (do/snooze/schedule).
- **Nudge budget**: max 2–3/day globally, each traceable to a real signal; budget enforced centrally in watchers.
- **People drift radar**: per-person cadence + last-contact + warmth decay; weekly "3 people drifting" card with fact-based openers.

### Phase 5 — Agency OS interlink
- Deep links: agency-flavored tasks/production/ideas rows get "open in Agency OS" → `shell.openExternal("http://localhost:3200/<section>")`; map task projects → sections (pipeline/creative/social/money…).
- Liveness: ping :3200; if down, offer one-click start (spawn `npm run dev -- -p 3200` in ofm-dashboard) or fall back to :3050 data.
- Agency summary card on Today: reads Agency OS `/api/overview` + `/api/alerts` when up, bridge/:3050 otherwise.
- Keep the shared task store sync (UGC/work/staff/tasks.json) as the write-path.

### Phase 6 — Gamification + polish pass
- Streaks with 1–2 auto-freezes + snowflake reveal ("I covered Tuesday for you").
- Identity votes: habit check-ins tally votes per identity; Donna narrates ("12 votes for 'ships daily' this month").
- Number tickers (streaks/scores), conic-gradient progress rings (@property), particle bursts on earned moments only, empty states with memory-driven lines, menu-bar tray title = current block + minutes left (Notion Calendar).
- Full design pass every page: typography, spacing, motion consistency.

## Anti-patterns (binding)
- Never reschedule silently — always diff + undo. Never lose a task. Rituals skippable in 10s. NL parsing visible + reversible. No activity-% headline. No keylogging. Nudges rationed — one weak nudge poisons all nudges. Sub-100ms interactions.

## Verification per phase
Launch app (`npm start`), exercise the feature end-to-end, syntax check all files, run `npm test`, commit per feature.
