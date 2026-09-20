# R&D — Task management + daily planning (2026-07-06)

Synthesis from deep research on Motion, Sunsama, Akiflow, Things 3, Todoist, TickTick, Amie, Notion Calendar, Reclaim.ai, Structured, Linear. Feeds the Donna V2 Tasks/Plan/Today rebuild.

## The 15 highest-leverage mechanics, ranked

1. **Guided Morning Plan + Evening Shutdown wizards (Sunsama)** — modal step-by-step rituals: Morning = shutdown time → triage inbox/overdue → pull tasks into Today with estimates → live "planned 6.5h / available 5h" overcommit meter → order/time-block. Shutdown = done/undone → per-task carry-forward (tomorrow/pick date/drop/won't-do) → time-by-area chart → one-line note → day closed. Most user devotion of anything researched.
2. **Start date vs hard deadline as separate fields (Things 3 + Motion)** — "show in Today on X" ≠ "due X". Deadlines = red countdown badge. `hard` deadlines trigger at-risk warnings when remaining estimated work > remaining free time.
3. **Global NL quick capture (Todoist + Things Ctrl-Space)** — OS-wide hotkey floating input; "call landlord tomorrow 3pm p1 #home =15m" parses with inline token highlighting and a visible "parsed as…" chip, one keystroke to revert.
4. **⌘K palette + single-key actions (Linear)** — palette teaches shortcuts inline; on selected task: E edit, P priority, D date, S schedule, W waiting, X multi-select. Optimistic updates; sub-100ms IS the premium feel.
5. **Today / Anytime / Someday + This Evening (Things 3)** — three activation states, not one giant list. Someday hidden from all counts. This Evening keeps after-hours items out of the workday view.
6. **Card-by-card triage wizard (TickTick "Plan Your Day" + Linear Triage)** — never a shame-pile of overdue; one card at a time, four big keys: today / pick date / someday / won't-do. Inbox-zero in 90 seconds.
7. **Time-block by drag + named containers (Akiflow Time Slots + Amie)** — drag task from rail onto timeline grid → becomes a block; named slots hold several small tasks; task and block are ONE object (checking block completes task).
8. **Real-time "now" line + Replan button (Structured)** — moving now-indicator on Plan timeline; Replan shifts past-uncompleted blocks forward into free slots WITH a preview diff before applying (Motion/Reclaim's silent-reschedule = #1 trust killer).
9. **Estimates + actuals with focus timer (Sunsama)** — estimate on every task (keys: 1=15m 2=30m 3=1h); shutdown shows planned-vs-actual; over weeks Donna learns your estimate bias ("you run 1.4× on writing") — AI edge nobody ships.
10. **Habit calendar defense (Reclaim)** — habits get windows ("Gym, 1h, 3×/wk, weekdays 6–9pm"); planner auto-places as flexible blocks that slide around fixed events, harden as the window closes, warn when about to be impossible.
11. **Weekly objectives linked to time (Sunsama + 12WY)** — 1–3 weekly objectives, each linked to a Goals OKR; tasks tag an objective; weekly review shows hours-on-objectives vs total. The Goals↔daily-execution bridge nobody does.
12. **Areas as the universal dimension (Sunsama channels + Things Areas)** — ONE life-area taxonomy (matching Life wheel: work/money/health/relationships) on tasks, blocks, habits, notes → shutdown pie, weekly review, Life page become real data.
13. **"Won't Do" completion state (TickTick)** — consciously-abandoned ≠ done ≠ delete. Honest reviews, kills guilt-pile, AI signal. Pair with auto-suggest Won't-Do for Someday items untouched 60 days.
14. **Capture with context autofill (Things Autofill)** — capture hotkey grabs frontmost browser URL/title/selected text/file path into the task note (AppleScript/AX).
15. **Menu-bar now/next strip (Notion Calendar)** — tray always shows current block + minutes left ("Deep work · 42m left"); click = mini-timeline + one-key actions. The ambient face of the product, seen 50×/day.

## Per-product signature mechanics (reference)

- **Motion**: auto-scheduling from duration+deadline+priority; hard vs soft deadlines; task chunking; at-risk warnings. Complaint: black-box moves erode trust.
- **Sunsama**: the ritual wizard; channels; weekly objectives; planned vs actual. Complaint: dormant if you skip the ritual — keep rituals skippable in 10s.
- **Akiflow**: universal inbox; Cmd+E global capture; syntax `#project *tag !priority <deadline =2h`; Time Slots; morning/evening/weekly rituals.
- **Things 3**: Today/Upcoming/Anytime/Someday; when vs deadline; This Evening; headings; Quick Entry Autofill; no priority field (order IS priority); calm polish benchmark.
- **Todoist**: NL parser with inline token highlight; filters query language; Karma streaks/levels.
- **TickTick**: Eisenhower matrix view; Plan Your Day wizard; Won't Do; pomodoro + habit in one.
- **Amie**: todo=event same object; sidebar rail → drag to grid; joy/springy animations. Complaint: beauty before reliability — NEVER lose a task.
- **Notion Calendar**: single-letter keys (C create, T today); menu-bar next-event countdown.
- **Reclaim**: flexible habit defense free→busy as window narrows; priority tiers; buffer time; focus-time goals.
- **Structured**: one vertical timeline, now-line, Replan button; icons+colors per block; ADHD favorite.
- **Linear**: speed as feature; Cmd+K teaches shortcuts; triage inbox; cycles auto-roll; auto-archive stale.

## Anti-patterns (from complaints)

- Never reschedule silently — always diff + undo.
- Never lose a task — persistence bugs are category death.
- Rituals must be skippable in 10s or they become guilt-ware.
- Parse NL visibly and reversibly.
- Depth honesty > ten shallow modules.
- Latency budget: sub-100ms interactions.

(Sources in the research agent transcript: usemotion.com/help, sunsama.com/features, culturedcode.com support articles, thesweetsetup.com, help.ticktick.com, efficient.app, help.reclaim.ai, linear.app/docs, medium.com/linear-app invisible-details, etc.)
