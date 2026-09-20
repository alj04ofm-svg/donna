# Donna v2 — Mac Menu-Bar Personal Assistant (v1 Design)

**Date:** 2026-07-05
**Status:** Approved (direction), pending spec review → implementation plan
**Owner:** Cam

## Context

Cam runs a solo AI-UGC operation (Anastasia/Leila reels via Higgsfield, a Next.js dashboard, multi-agent herdr panes, an M3 agent, FluidVoice dictation). He wants a **personal AI assistant** he can talk to that already knows his whole operation — able to answer "what's on my plate," capture notes/todos, help creatively, and act as an everyday PA. It should have a clean avatar/presence and hook into his existing voice setup.

An earlier attempt (`freeflow-donna`) built the assistant *thinking* (personality modes, work-context roots, voice) but on a brittle native macOS/WebKit shell that repeatedly failed (VRM never rendered — WKWebView blocked local file loads; native mic/speech TCC permissions never granted; duplicate windows; iCloud file conflicts). This design keeps the good ideas and rebuilds on a reliable shell.

**Intended outcome:** a genuinely useful daily-driver assistant, summoned by a hotkey, that Cam talks or types to and that knows his work — shipped as a focused v1, then grown.

## Decisions (locked)

- **Form:** macOS **menu-bar app**, summoned by a global hotkey. (Chosen over floating avatar / in-dashboard / WhatsApp-first for v1; those are later phases.)
- **Identity:** name **"Donna"**; personality **sharp operator** — fast, direct, no fluff, always ends with what matters / the next action.
- **Interaction:** voice + text, equally.
- **Voice out:** a **local clone of "Ximena"** — a real girl's voice Cam already recorded. Reference audio exists in `UGC/work/anastasia/voice_source_pack_2026-06-04/` (`source_clips/*_75s.mp3` real recordings, `ximena_voice_source_2026-06-04/`, and `ximena_production_clone/*.mp3` 6–8s clips). Synthesize **locally** with an open-source zero-shot voice-cloning TTS — **F5-TTS** (realism leader) or **XTTS-v2 / Coqui** (most plug-and-play) — running on the Mac. No cloud, no ElevenLabs, no payment. (MiniMax TTS rejected as robotic; ElevenLabs is payment-blocked and no longer needed.) Consideration: local neural TTS adds ~1–3s latency per utterance → stream / chunk by sentence; voice-out sits behind a flag so text answers stay instant. A one-time quality bake-off (F5-TTS vs XTTS-v2 on the Ximena reference) picks the engine during implementation.
- **Voice in (v1):** dictation via **FluidVoice** into the panel's input box (native push-to-talk is v1.5).
- **Brain:** **3-tier / routed**, tool-enabled. A **model router** in the Brain Bridge classifies each request and picks the cheapest model that fits, with explicit overrides:
  - **M3 (MiniMax) — the everyday default.** M3 is very capable, so normal questions, lookups, status, capture, and most day-to-day work go here.
  - **Claude Opus 4.8** (`claude-opus-4-8`) — *escalation* for genuinely important / hard reasoning (decisions, analysis, tradeoffs, "should I… / why").
  - **Fable 5** (`claude-fable-5`) — *escalation* for top creative / hard generation (scripts, hooks, copy, brainstorming, strategy).
  Overrides: "quick:" → force M3; "think:" → force Opus; "best:" → force Fable. **Default to M3; escalate only when the request is clearly important or creative** — never burn Opus/Fable on routine stuff.
- **Tech:** **Electron** + web UI. Explicitly NOT native Swift/WKWebView — that shell was the source of every failure in `freeflow-donna`. Electron/Chromium loads local files, mic, and TTS reliably, and the web UI can be made premium.

## Users & Success Criteria

Single user (Cam). v1 is successful when he can:
1. Press a global hotkey anywhere and a panel appears in <500ms.
2. Type OR dictate (FluidVoice) a question and get a streamed text answer, spoken aloud.
3. Ask about his real work ("what's on my plate", "status of the WC reels") and get an accurate, context-grounded answer.
4. Capture a note/todo by voice or text and read it back later.
5. Ask for creative help (a hook, a script angle) grounded in his UGC standards.
6. Do all of the above without the app crashing, duplicating windows, or fighting permissions.

## Architecture

Electron app. **Main process** owns the menu-bar (tray) item, the global hotkey, the panel window, and the Node-side services. **Renderer** (web UI) is the panel: input, streamed answer, and the animated aura. IPC connects them.

```
[global hotkey] → main → toggle panel window
panel input (typed / FluidVoice-dictated)
   → IPC → Brain Bridge → (Context Provider gathers state) → M3/Claude (tool-enabled)
   → stream tokens back → panel renders text + aura "speaking" → Voice-Out (MiniMax TTS) plays
capture intents ("note:/todo:") → Capture Store (read/write) 
```

### Components (each isolated, one purpose)

1. **Shell (main process)** — creates the tray item, registers the global hotkey (default ⌥Space, configurable), owns a single frameless always-on-top panel window (toggle show/hide; never duplicates), handles quit/relaunch. *Depends on:* Electron. *Interface:* emits `toggle-panel`, forwards renderer IPC to services.

2. **Panel UI (renderer)** — the web UI: text input, streamed answer area, animated aura (idle / thinking / speaking states via CSS/canvas), a "speak answers" toggle, and a small capture/notes view. *Depends on:* IPC to main. *Interface:* sends `ask(text)`, `capture(text)`, receives `token`, `state`, `answer-done`.

3. **Brain Bridge** — receives a user message, asks the Context Provider for the current context bundle, builds the sharp-operator system prompt, runs the **model router** (classifies the request → M3 / Opus 4.8 / Fable 5, honoring any explicit override), calls the chosen model with tool-use, streams tokens back to the panel, and detects capture intents. *Depends on:* the model router (M3 via the reused `minimax_agent` engine; Opus/Fable via Anthropic API or the `claude` CLI — resolved in the plan), Context Provider, Capture Store. *Interface:* `ask(text) → stream(token) → done(answer)`.

4. **Context Provider** — gathers Cam's live work state into a compact bundle the brain can read: `MEMORY.md`, selected UGC SOP/standard files, dashboard JSON (models/posts/tasks under `UGC/work/`), herdr pane status (`herdr pane list`), the mm_queue, and the Capture Store. Returns a trimmed, prioritized context string (with pointers the brain can expand via tools). *Depends on:* filesystem, `herdr` CLI. *Interface:* `getContext(query) → { summary, pointers }`.

5. **Capture Store** — a simple local store (one JSON file, e.g. `data/capture.json`) of notes/todos with `{id, kind: note|todo, text, done, created_at}`. Read and append; mark todos done. *Interface:* `add(kind, text)`, `list(filter)`, `complete(id)`.

6. **Voice-Out** — turns an answer into speech via a **local Ximena voice clone** (F5-TTS or XTTS-v2, reference clip baked in), plays it, and signals the aura to animate while speaking / stop on interrupt. Streams/chunks by sentence to hide model latency. *Depends on:* a local Python TTS process + the Ximena reference audio. *Interface:* `speak(text) → playing → done`; `stop()`.

**Voice-In** is external: FluidVoice dictates into the focused panel input. Nothing to build in v1.

## Personality (system prompt shape)

Donna, a sharp-operator personal assistant for Cam. Knows his UGC operation, dashboard, herdr work, and tasks (provided as context). Answers fast and direct, no fluff, no sycophancy; leads with the answer, ends with the next action when relevant. Can use tools to read files / check state / run safe commands before answering. Captures notes/todos when asked. Never spends credits or takes destructive actions without explicit confirmation.

## Data

- `data/capture.json` — array of `{id, kind, text, done, created_at}`.
- `config.json` — hotkey, voice on/off, Ximena reference-clip path, model-routing preferences, context roots (which files/dirs the Context Provider reads).

## Non-Goals (v1)

WhatsApp, calendar, wake-word / hands-free, phone client, floating desktop avatar, multi-user, writing to dashboard data. All deferred.

## Roadmap

- **v1** — this spec: summon, ask (voice+text), knows your work, quick capture, creative help, MiniMax voice.
- **v1.5** — native push-to-talk (in-app mic + STT), complete/edit todos, richer capture views.
- **v2** — WhatsApp channel (same brain), calendar.
- **v2.5** — wake-word; optional ambient floating avatar mode.
- **v3** — richer personality + expressive avatar.

## Verification (v1, end-to-end)

1. Launch app → tray icon appears; global hotkey toggles the panel (open/close), never duplicating windows.
2. Type "what's on my plate today" → streamed answer references real dashboard/herdr/memory state; answer is spoken via the local Ximena voice clone; aura animates then idles.
3. Dictate the same via FluidVoice into the box → same result.
4. "todo: source the 6 WC football clips" → appears in `data/capture.json`; "what did I capture today" reads it back.
5. "give me a scroll-stop hook for a gossip reel" → answer reflects UGC standards from context.
6. Kill/relaunch → single clean instance; no permission walls (Electron mic/TTS work out of the box).
