# Donna

A local-first personal assistant for macOS. Donna lives in your menu bar and on
your desktop, keeps your tasks, goals, habits, notes and focus sessions in one
place, and answers questions using **your own** AI key.

Everything stays on your Mac. No account, no cloud sync, no telemetry.

## What's inside

- **Today** — a calm start: your focus task, today's list, habits, and a short brief.
- **Tasks** — horizons + a 3-column board, priorities, due dates, estimates, focus timers.
- **Plan** — time-block your day around your calendar.
- **Goals** — objectives, key results, milestones, weekly commitment.
- **Habits** — flexible daily/weekly habits with streaks.
- **Notes & Library** — durable notes, highlights, captures.
- **Ask Donna** — chat that uses the files you point it at as context.
- **Tracker** — optional, fully local time tracking (screen recording permission required).
- **Capture** — a global quick-capture bar (default `⌥Space`).
- **Settings** — name, AI provider + key, notifications, permissions, data export.

## Install

1. Download `Donna-<version>-universal.dmg` from Releases.
2. Open it and drag **Donna** to **Applications**.
3. First launch: right-click the app → **Open** (it's not notarized yet), or run:

   ```sh
   xattr -dr com.apple.quarantine /Applications/Donna.app
   ```

4. Open Donna → **Settings → General** → set your name, pick an AI provider, paste your API key.
5. Press `⌘⇧Space` to summon her anywhere.

## AI providers (bring your own key)

Set the key in Settings, or via environment variables (which take precedence):

| Provider  | Env var              |
|-----------|----------------------|
| Anthropic | `ANTHROPIC_API_KEY`  |
| OpenAI    | `OPENAI_API_KEY`     |
| MiniMax   | `MINIMAX_API_KEY`    |

You can also use the local `claude` CLI (no key) by choosing **Claude CLI**.

## Your data

Stored locally at `~/Library/Application Support/Donna/` — tasks, notes, goals,
habits, tracker events and config (mode `0600`). Export a backup any time from
**Settings → Data**.

## Build from source

```sh
npm install
npm start          # run in development
npm run dist       # build the .app + .dmg into dist/
```

Built with Electron. Tested on macOS 14+ (Apple Silicon and Intel).
