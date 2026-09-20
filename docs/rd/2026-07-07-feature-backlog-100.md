# 100+ feature ideas — Donna backlog

Per Alex's brief: "think of a hundred other features... ask me loads of questions." This is that list — grouped, concrete, not vague. Nothing here is built; it's a menu. Say the word on any of these and I'll scope + build it properly (screenshot-verified, committed, no half-finishes).

## Ask / the AI hub
1. Multi-turn memory of the CURRENT thread fed back into brain.ask (right now each ask is stateless beyond history recall)
2. "Pin" a Donna answer to Notes/Library with one click
3. Slash-commands in the input (`/task`, `/note`, `/goal`) that route without typing full sentences
4. Model-cost/latency badge per reply (which tier answered, how long it took)
5. Voice input in the Ask hub itself (mic icon → dictate the question), not just wake-word
6. "Explain like I'm tired" toggle — shorter, blunter answers late at night (cross with Tracker's time-of-day)
7. Compare mode — ask the same question to two tiers (quick vs best) side by side
8. Auto-suggest follow-ups after an answer ("Want me to turn this into a task?")

## Orb / desktop presence
9. Multiple orbs — one per "hat" (Agency, Personal, World Cup) with different colored auras
10. Orb reacts to Tracker's Pulse score (glow brighter when focus is high, dims when scattered)
11. Drag a task/idea card onto the orb to "hand it to Donna" (quick capture via drop target)
12. Orb corner-snap — magnetizes to nearest screen edge/corner when dragged close, like macOS Simulator
13. Right-click orb → quick menu (Pause tracker, Today's brief, Quit) without opening the full window
14. Orb shrinks to a menu-bar-style dot when a fullscreen app is frontmost, un-shrinks after

## Voice
15. Two-way voice conversation mode — hold a key, talk, release, she answers out loud, no typing at all
16. Wake word confidence — currently any dictation starting "donna" triggers; add a quick "cancel" window (3s) in case it mis-triggered
17. Custom wake phrase (some people won't want "Donna" literally — configurable in Settings)
18. Voice note → auto-classified as task/idea/journal (right now voice notes only count toward Tracker's Pulse)

## Tasks / Plan
19. Recurring tasks (daily/weekly templates that regenerate)
20. Task dependencies ("blocked by" another task, not just a person)
21. Bulk actions in Tasks list (multi-select → bulk snooze/priority/delete)
22. Plan's Week view: drag a task card from Unscheduled onto a day to set its due date
23. "Energy" tag on tasks (deep/shallow) cross-referenced with Tracker's best-focus-time to suggest scheduling
24. Time estimates vs actuals report — where do estimates consistently miss?
25. Calendar view (month grid) as a third Plan layout alongside Timeline/Week

## Tracker
26. Per-app daily budgets (e.g. "max 30m in Telegram") with a gentle nudge at 80%
27. Compare today vs same-weekday-last-week
28. Export a shareable (redacted) focus report for George/investors without exposing screenshots
29. "Deep work" auto-detected sessions get their own highlight reel of screenshots (a visual recap)
30. Idle-time breakdown — what typically causes the longest away-blocks?

## Production / Agency OS
31. Push notification the moment voice-swap gate clears (someone else fixes it) instead of polling
32. Per-account posting cadence tracker — flag an account that hasn't posted in 48h
33. One-click "open this account's folder" from the post-ready list
34. Content pipeline funnel chart (ready → generated → voice → posted) as a visual, not just 4 numbers
35. Auto-draft the handoff message to George when voice-swap blocks pile up

## Goals / Life
36. Goal templates ("12-week OKR", "habit-stack") to remove blank-page friction
37. Auto-link a Goal's key result to a Tracker category (e.g. "reels edited" KR ticks itself from Production data)
38. Life vision → auto-suggest a Goal when a step keeps getting skipped
39. Milestone celebrations — a small animation/sound when a goal hits 100%
40. "Why it matters" prompts surfaced back to you weekly (identity reinforcement, Atomic-Habits style)

## Canvas
41. Connectors/arrows between cards (mentioned, not yet built — real next step)
42. Sticky templates (funnel map, launch checklist) insertable in one click
43. Paste an image directly onto the canvas (drag-drop from Finder)
44. Card → convert to a Goal or Note, not just a Task
45. Multiple cursors/presence if George ever gets his own view (future multi-user)

## Library (Capture/Notes/Ideas)
46. Full-text search across all three tabs at once
47. Tag system shared across Notes/Ideas (not just niche on Ideas)
48. Idea → auto-scored by a quick AI pass ("hook strength 1-10") before you even open it
49. Notes get backlinks (mention a project name, auto-link to related notes)
50. Capture inbox zero streak — gamify clearing it daily like Tasks

## People / relationships (currently removed from nav, logic still exists)
51. Resurface People as a widget inside Comms instead of its own page (birthday/cadence nudges only)
52. Auto-detect "George" mentions across Tasks/Capture and surface a daily "things George is waiting on" digest

## Comms (deprioritized, but the eventual shape)
53. Priority inbox — Gmail/Telegram/WhatsApp messages from a starred contact list surfaced in one place
54. Reply drafting through Donna ("draft a reply to George's last message")
55. Digest mode — one daily summary instead of live-polling three inboxes

## Meetings (Meetily-style, gated behind your go-ahead)
56. Local whisper.cpp transcription of any call, auto-saved as a Note
57. Auto-extract action items from a meeting transcript straight into Tasks
58. Meeting → auto-linked to the Goal/Project it was about

## Settings / system
59. Per-view "reset to defaults" without wiping all data
60. Backup reminders (export nudge if it's been >30 days since last one)
61. Theme variants (a lighter "daylight" mode for screen-glare mornings) — kept dark-only by design so far, but worth asking
62. Import — restore from an exported backup, not just export

## Gamification / identity (already partly built — streaks, votes)
63. Weekly "identity report card" — a short AI-written reflection on who your actions this week say you are
64. Combo streaks across domains (Tasks + Tracker + Habits all green in one day = a bigger visual moment)
65. A visible "season" or cycle reset (12-week year aligns with Goals' horizon) — fresh start ritual

## Cross-cutting / architecture
66. Global command bar search that also searches CONTENT (not just navigate-to-view) — "find the note about Songkran"
67. Undo/redo for destructive actions (delete task, delete card) — a 5s "Undone ↺" toast window
68. Offline-first conflict resolution docs (not urgent solo-user, but worth a note if George ever gets his own Donna instance)
69. A single "What changed since I was last here" digest when reopening after >4h away
70. Keyboard-only mode audit — make sure every action has a shortcut, for power use

## Longer-shot / ambitious
71. Donna proactively drafts the next day's Plan the night before (shutdown ritual → tomorrow's blocks pre-filled)
72. A "second brain" weekly review ritual that pulls from Tracker + Tasks + Goals + Life into one narrative recap
73. Local small-model fallback for `quick:` tier so it works with zero network at all
74. A public (opt-in) "build in public" mode that auto-drafts a tweet/post about what shipped each week
75. Cross-device: a read-only companion view on iPhone (Shortcuts + a tiny local API) for glance-only status

---
Not all of these are equally worth building — treat this as a menu, not a queue. Tell me which ones matter and I'll turn them into real, scoped, screenshot-verified work the same way as everything shipped today.
