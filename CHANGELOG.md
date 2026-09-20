# Changelog

All notable changes to Donna are documented here. This project follows
[Semantic Versioning](https://semver.org/).

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
