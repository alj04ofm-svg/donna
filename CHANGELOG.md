# Changelog

All notable changes to Donna are documented here. This project follows
[Semantic Versioning](https://semver.org/).

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
