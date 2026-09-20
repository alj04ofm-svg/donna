# Changelog

All notable changes to Donna are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [1.7.0] — 2026-09-20

- Fixed the AI-coach button overlapping Plan's Timeline/Week/Forecast tabs.
- Settings shows the real app version; calendar-permission copy now says Donna.

## [1.6.0] — 2026-09-20

- **New Habits page** — daily routines with streaks, identity votes and
  one-tap completion. Added to the sidebar (Life group).

## [1.5.0] — 2026-09-20

- **New task composer**: “＋ New task” button and the `n` shortcut open the full
  editor (title, notes, priority, due, project, assignee, estimate, subtasks,
  recurrence) to create a task properly — not just quick-add.
- Today's morning brief no longer shows provider/config errors.

## [1.4.0] — 2026-09-20

- **OpenCode gateway provider** (OpenAI-compatible): point Donna at your own
  gateway + model. No external paid providers by default.
- Settings now has Gateway URL + Model fields alongside provider + key.

## [1.3.4] — 2026-09-20

- Removed the last personal seed content (habit/replacement examples) so every
  new user starts clean and generic.

## [1.3.3] — 2026-09-20

- Native macOS shell: SF system typography (no web fonts), wider sidebar,
  tighter CSP.

## [1.3.2] — 2026-09-20

- Ask now shows which AI answered (Gemini / Claude / etc.).

## [1.3.1] — 2026-09-20

- Added a **Google Gemini** provider (bring your own key) and made it the
  default path for Ask.

## [1.3.0] — 2026-09-20

- **Subtasks** on tasks (checklist in the editor, progress chip on rows/cards).
- **Recurrence** setting in the task editor (daily / weekdays / weekly).
- **Search, filter and sort** on the Tasks page (by text, priority, project,
  due date or newest).

## [1.2.0] — 2026-09-20

- **Assignees on tasks** — assign a task to a person (or leave it as you); shown
  as an @chip on lists and cards, set in the task editor.
- **Relationship types on people** — tag each person Work / Client / Partner /
  Friend / Family (click the chip to cycle).

## [1.1.1] — 2026-09-20

- Task editor now saves title, notes and project (they were silently ignored by
  a field whitelist).

## [1.1.0] — 2026-09-20

- **Task editor.** Open any task (the ✎ button on a row, or double-click a task
  in List, Board or By-project) to edit title, notes, priority, due date,
  project and estimate — or delete / mark won't-do.
- Fixed the desktop app not opening: `/Applications/Donna.app` is now the app
  (was the old launcher).

## [1.0.4] — 2026-09-20

- Polished People page (friendly empty state; tabs no longer clash with the AI coach button).
- Removed the last internal wording from the Tasks header.
- Verified end-to-end: fresh install → onboarding → add task → persists (no errors).

## [1.0.3] — 2026-09-20

- **Clearer IA, fewer pages.** Sidebar is now Today · Tasks · Goals · People ·
  Notes · Ask · Tracker · Settings (Plan sits at the top).
- **People and Waiting merged** into one page with tabs (your circle + what they
  owe you).
- **Library renamed Notes** (Notes · Ideas · Captures in one place).
- Removed Comms, Canvas, Life, Activity and Log from the nav entirely (their
  section toggles too).

## [1.0.2] — 2026-09-20

- Fixed: the API key entered in Settings is now actually used by the AI providers.
- Privacy: tracker screenshots default **off**.
- macOS usage descriptions added (microphone / calendar / automation) so prompts
  name Donna correctly.
- Removed half-wired Voice + Wake-word toggles.
- Added a strict Content-Security-Policy to the renderer.
- DMG now includes an Applications shortcut; release CI runs tests before building.
- Renamed `views-ops.js` → `views-ask.js`.

## [1.0.1] — 2026-09-20

- Cleanup pass for the public build: removed all app-specific/agency content,
  seed data and prompts (no more hardcoded names anywhere — Donna uses the name
  you set). Generic demo data. Greeting and AI prompts now use your name.
- Fixed the tracker + context tests (13/13 passing).

## [1.0.0] — 2026-09-20

First finished release.

- First-run setup wizard: your name → AI provider + key → what Donna may read.
- Bring-your-own-key AI: Anthropic, OpenAI, MiniMax, or the local `claude` CLI.
- Core modules: Today, Plan, Tasks, Goals, Habits, Notes/Library, Ask, Tracker,
  Capture, Settings.
- Global hotkeys: `⌘⇧Space` (summon), `⌥Space` (quick capture).
- Desktop orb + menu-bar presence.
- All data stored locally in `~/Library/Application Support/Donna`.
- One-line installer (no Gatekeeper warning) and DMG downloads.
- In-app update check with one-click self-update (works without code signing).
- Universal build (Apple Silicon + Intel), ad-hoc signed.

## [0.3.1] — 2026-09-20

- Installer ad-hoc signs the app so Apple Silicon always runs it.

## [0.3.0] — 2026-09-20

- One-line installer; in-app update check.

## [0.2.0] — 2026-09-20

- First-run setup wizard; universal build; removed app-specific UI.

## [0.1.0] — 2026-09-20

- Initial public build (Apple Silicon).
