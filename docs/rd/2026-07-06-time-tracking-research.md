# R&D — Time tracking / personal analytics (2026-07-06)

Synthesis from deep research on ActivityWatch, RescueTime, Rize.io, Timing, Hubstaff, Toggl, macOS Screen Time. Feeds the Donna V2 Tracker rebuild.

## Key architecture decisions (from research)

- **Capture**: main-process loop every ~4s using `get-windows` npm (`@rize-io/get-windows` fork — battle-tested in Rize's production Electron app) → `{title, owner:{name,bundleId}, url}` + `powerMonitor.getSystemIdleTime()` (no permission needed).
- **Heartbeat merge (ActivityWatch)**: consecutive identical `{app,title,url}` samples within a pulsetime (~10s) merge into one duration event. Full workday ≈ few hundred events ≈ ~50KB/day.
- **AFK rule**: idle >180s → AFK retroactive to last input; AFK masks window events at query time. Close events on `powerMonitor` suspend/lock.
- **Permissions**: Screen Recording (window titles), Accessibility (fallback/URL), Automation per-browser (AppleScript URL). Pre-flight via `systemPreferences.isTrustedAccessibilityClient(false)` + `getMediaAccessStatus('screen')`; degrade to app-only mode without them.
- **Activity level without keylogging**: derive per-minute activity from `getSystemIdleTime()` deltas. Never use global event taps.
- **Categorization (ActivityWatch semantics)**: hierarchical categories, regex/keyword rule over `app|title|url-domain`, deepest match wins, computed at query time (rule edits re-score history). Ship ~30 defaults.
- **Productivity score (RescueTime formula)**: levels −2..+2 per category; Pulse 0–100 = `(((vd*0)+(d*1)+(n*2)+(p*3)+(vp*4)) / (total*4)) * 100`.
- **Focus session detection (Rize)**: ≥25 min where one productive category ≥80% share and <4 context switches/10min. Report deep-work total, longest block, switches/hr.
- **Skip**: activity-% as headline metric (Hubstaff's most-hated), keylogging, cloud, website blocking (v2), reading knowledgeC.db.

## Top 10 features, ranked

1. Heartbeat capture engine (4s poll, merge, SQLite/JSON per-day, close on suspend/lock) — replaces screenshot-only tracker as source of truth.
2. AFK segmentation + optional "away 22 min — keep or discard?" prompt (Toggl).
3. **Day timeline strip with evidence drawer** — hero UI: zoomable colored band midnight→now, gray=AFK; click a block → merged titles/URLs + nearest screenshots (Rize suggestion-review pattern).
4. Rule-based categorization with retroactive re-scoring.
5. Productivity score dial + 30-day trend sparkline — the daily hook.
6. Focus/deep-work detection (~50 lines over event list).
7. Menu-bar live status + nudges: >20min continuous Distracting → nudge; >90min continuous real work → break reminder; daily threshold alerts. All local Notification().
8. **End-of-day LLM recap (Donna differentiator)** — feed day's events+stats to the brain for a 5-line honest narrative; no commercial tool does this well.
9. Screenshot linkage: index existing periodic shots by timestamp against timeline events; auto-delete after N days; per-app blacklist.
10. Permissions onboarding checklist + graceful degradation (the #1 "it stopped tracking" cause everywhere).

## Product lessons

- Hubstaff: keep evidence trail (screenshots, activity), frame as **self-memory not proof-of-work**; never headline activity %.
- Toggl: passive timeline + explicit "promote to entry" is the right consent model; keyword→timer suggestion (Autotracker) is cheap and delightful.
- Timing: AX primary, CGWindow fallback for title-less apps; idle gaps → "what did you do?" backfill prompt.
- RescueTime Focus Sessions: timed block, distraction blocking levels, end summary. Focus Zones: suggest sessions in historically-productive meeting-free hours.
- Rize: menu-bar session timer (time since last break, start Focus/Break, pause tracking); meetings excluded from focus time; click any block → underlying evidence.
- ActivityWatch complaints = our gaps to win: clunky UI, no scoring/nudges, manual regex setup, weak sync.

Sources: docs.activitywatch.net (watchers/faq/categorization), help.rescuetime.com (73, 456, 374), rize.io/features + changelog, timingapp.com/help/faq, support.hubstaff.com activity-levels, toggl timeline/autotrack, npm get-windows / @rize-io/active-win, Electron powerMonitor docs, scriptide.tech Obj-C++ window tracking, knowledgeC.db gist (0xdevalias).
