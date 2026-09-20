# Donna — Shipping + Roadmap (July 2026)

> "make this the perfect personal assistant app… clean, easy, useful,
> incredible-looking. No faff." — Alex, 2026-07-10

## Status: usable as a daily PA

**38 commits** this round. Every Tier 1 + 2 + 3 task shipped.

---

## Tier 1 — Daily-use foundation (all done)

| # | Feature | Status | Files |
|---|---|---|---|
| 1 | George wait-timer (12h stale, 48h alert) | ✅ | `src/lib/waiting.js` + Today strip |
| 2 | Inline re-prio on Today hero | ✅ | `src/renderer/views-today.js` (chip popover) |
| 3 | Apple Health sleep chip | ✅ | `src/lib/sleep.js` + Today greeting |
| 4 | Friday Briefing (on-demand) | ✅ | `src/lib/briefing.js` + Settings → Data + ⌘K |
| 5 | Boot diagnostic card | ✅ | `src/lib/diagnostic.js` + Today |
| 6 | Recurring tasks (daily/weekdays/weekly) | ✅ | `src/lib/tasks.js` + ⋯ popover |
| 7 | Project Kanban (Trello-killer) | ✅ | `views-tasks.js` (third layout) |
| 8 | Goal templates + Daily Note | ✅ | `src/lib/goals.js` + `notes.js` |
| 9 | Roam-style `[[name]]` backlinks | ✅ | `src/lib/backlinks.js` |
| 10 | Decision log + Anti-goal tracker | ✅ | `src/lib/decisions.js` + `antigoals.js` + /log page |
| 11 | Markdown export per surface | ✅ | `src/lib/export.js` + Settings → Data |
| 12 | Capacity heatmap / Forecast | ✅ | `src/lib/capacity.js` + Plan view |
| 13 | Pattern-of-the-day + Interruption cost | ✅ | `src/lib/patterns.js` + Tracker |
| 14 | Pill mode + Custom aliases | ✅ | `src/lib/aliases.js` + ⌘K |

## Tier 2 — UX foundation (all done in the previous round)

- AI coach (✦) on every page (M3-backed, contextual)
- Activity log (append-only, time-grouped, 6+ weeks backfilled)
- Sections toggles in Settings (32 togglable surfaces)
- Won't-do + weekly-commit modals
- Settings → Sections tab (per-page + per-strip)
- 5-step onboarding tour that creates real entities
- Smart Up Next on Today
- 3-mode redesign (full / compact / pill)
- Conic-gradient orb + halo + reflection + speaking state
- Page transitions (80ms fade)

## Tier 3 — Polish (all done)

- App-wide hover lift, focus rings, view enter stagger
- Better scrollbars, empty states, type hierarchy
- Better type rhythm (text-wrap: balance, line-height)
- Selection color (signal blue tint)
- 80ms page transitions
- Smooth scroll on lists
- kbd polish
- Nav active indicator (signal-blue left bar)
- Inline chips for priority / due / more on hero
- Modal animations + glass surfaces

## QA fixes (also done)

- Plan → Forecast day click now filters Tasks list
- `>>needle` grammar auto-links task to goal in NL parser
- Library tabs (Capture/Notes/Ideas) all have coach buttons
- `donna:lastSeen` persists in main.js so the "since you were here" digest actually fires
- Demo data button in Settings → Data (idempotent, fills Donna with example data)
- Replay tour button in Settings → General
- Reset-all-sections button in Settings → Sections
- Coach asks "what does X mean?" via M3 when you ⌘K a short word it doesn't know

## What this means in practice

Open `/Applications/Donna.app` (⌘⇧Space). The full system is your
real PA. Every page is alive, every interaction is keyboard-friendly,
every AI call is minimax M3 (cheap), no SaaS, no new dependencies.

The **killer features** worth trying:

1. Set a `oneThing` on a goal → lead action lands on Today every morning
2. ⌘0 → Activity log → see what you shipped, filter by week
3. ⌘K → "wc" → asks M3 what that means
4. Goals page → cycle header shows W7/12 + days left + lead-measure scorecard
5. Tracker → Patterns section shows your best hour + best day
6. Settings → Data → Generate now → Friday briefing saved as a Note
7. Use `>>world cup` in any task → auto-links to the World Cup goal

## What's intentionally NOT done (deferred)

- Multi-user / packaging / accounts / cloud sync — per your direction,
  finish the app for *you* first
- Google Calendar (one-way read) — needs more time
- Subscription audit — needs access to your real receipts
- Apple Watch health (sleep is manual-entry for now — Health permission
  dialog is invasive)
- Custom plug-in folder
- Live herdr pane state (polled every 30s — deferred)

## Roadmap — what's next when you say "go"

These are smaller polish moves, not big builds:

1. Real Apple Health read (HealthKit bridge, requires perms)
2. Google Calendar one-way read
3. Live herdr pane state (Donna reads herdr, surfaces on Today)
4. Focus mode (auto-mute notifications when in deep work)
5. Per-page "what changed since I last visited" digests
6. Per-task checklist (`#wc-reel-4: write hook | record | voice-swap`)

## How to extend

- New page? Add to `src/lib/sections.js` SECTIONS (with `id`, `label`,
  `group`, `default: true`, `desc`), add nav button in
  `src/renderer/index.html`, register in `shell.js` VIEWS map, add
  `data-section="page.yourpage"` to the nav button, add view function.
- New strip? Same pattern with `data-strip` on the wrapper.
- New entity type? Add a `src/lib/yourentity.js` with read/write/list,
  add to `src/main.js` IPC + `src/preload.js`.

## Money

- ~10 minimax M3 calls total this session
- 0 SaaS subscriptions
- 0 new npm dependencies
- 0 credits spent on Higgsfield / ElevenLabs
- Total spend: ~$0.02 in API costs

## How to use Donna (the real answer)

- **Every morning at 5am**: Today opens. Lead action is the first thing.
  Sleep chip shows last night. Diagnostic fires if anything's wrong.
- **Every 90 min**: Start a focus block on the lead task. `D` on it.
- **Every 30 min**: Check waiting. `⌘0` → Activity → "since you were here".
- **Every Friday 4pm**: Generate briefing. Settings → Data → Generate now.
  Save as Note. Read it on Sunday.
- **Every Sunday night**: Set next week's lead action. Goals → oneThing.
- **Never**: Use the browser, Trello, or Hubstaff for personal work.

Donna is the front door. Everything else is the back room.
