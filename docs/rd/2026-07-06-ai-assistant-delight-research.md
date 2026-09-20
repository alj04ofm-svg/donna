# R&D — AI assistant "knows me" mechanics + delight UX (2026-07-06)

Synthesis from deep research on Martin, Dot (New Computer), memory-system SOTA, Raycast, Duolingo, Atoms, Sunsama, Clay/Dex/Monica, Day One, Linear, Things 3, Family wallet, Amie, Emil Kowalski animation rules.

## Top 10 "knows me and runs my day" mechanics, ranked

1. **Morning Brief + Evening Shutdown ritual pair** — auto-generated at chosen times; brief = calendar/tasks/habits + one memory-driven personal line; the anchor habit.
2. **Ambient memory capture with visible acknowledgment** (Dot's green flash) — mine chats for facts into a structured store, inline "remembered ✓" glint, plus a browsable/editable Memory page (trust = inspectability).
3. **Memory callbacks** — unprompted references to stored facts in briefs/replies. Highest magic-per-token. Rule from Dot's death: never fabricate specifics; low confidence = stay silent.
4. **High-precision proactive nudges, strictly rationed** — 2-3/day budget, each one-tap actionable, each traceable to a real signal. One weak nudge trains the user to ignore ALL nudges.
5. **NL capture with live token highlighting** via global hotkey (Todoist × Raycast Quick Capture).
6. **Relationship drift radar** (Clay/Dex/Monica) — per-person cadence + warmth decay + weekly "3 people drifting" card with fact-based suggested openers.
7. **Bounded streaks with auto-applied freezes** (Duolingo) — 1-2 auto-equipped freezes discovered retroactively as a gift ("I covered for you Tuesday"). Bounded slack > rigid rules (UPenn/UCLA).
8. **Identity votes** (Atoms) — habit check-ins framed as "votes for [identity]"; Donna narrates the tally ("12 votes for 'disciplined founder' this month").
9. **Weekly Review as a generated artifact** (+ monthly/yearly "Wrapped") — time patterns, habit rates, wheel deltas, people contacted, resurfaced memory ("On This Day").
10. **Agentic quick actions from the brief** — every brief/nudge item carries one-tap actions (snooze/schedule/draft/done). Doing, not telling.

## 12 delight patterns (vanilla CSS/JS, implementation-ready)

1. **Things checkbox pop** — scale 1→1.15→1 with `linear(0, 1.4 60%, 1)` spring, radial `clip-path` fill wipe, animated gradient strike-through. ~150ms + sound.
2. **Particle burst** — 12-20 4-6px divs, random vectors, WAAPI `el.animate()` 500-700ms ease-out, removed after. Reserve for significant moments only (selective emphasis — Family doctrine).
3. **Staggered list entrance** — `animation-delay: calc(var(--i) * 25ms)`, cap at ~10 items. (Already partially built via `--i`/si().)
4. **Number ticker** — per-digit vertical strips translated with spring; or `@property --n` + `counter-set` pure-CSS count-up.
5. **Progress rings** — `conic-gradient` + `@property --p` for smooth animation + mask hole; 1.05 pulse at 100%.
6. **Asymmetric timing (Linear)** — appear ≤80ms, exit ~150ms; nothing interactive over 300ms. The single biggest "premium" convention.
7. **FLIP layout moves** — ~15 lines vanilla; record rects before/after, invert, spring to identity. Reordering feels physical; animation as explanation.
8. **⌘K palette** — instant results, 80ms staggered fade first-open only, `backdrop-filter: blur(8px)`.
9. **Live parse-token highlighting** — transparent input stacked on a mirror div rendering `<mark>` spans; marks fade in 150ms as recognized.
10. **Streak-freeze snowflake reveal** — frost tile, snowflake scales in with overshoot + shimmer, "I covered Tuesday for you." Guilt moment → warmest moment.
11. **Sound design (3-4 sounds, Web Audio API)** — synthesized oscillator+gain envelopes (no files): soft 2-note tick (complete), warmer chime (habit), rising 3-note (milestone), muted pop (capture). Fire at animation's visual peak. Global mute, low gain default.
12. **Empty states + idle personality** — every empty view gets a memory-driven one-liner + one suggested action; breathing orb 4s loop, pauses on blur/reduced-motion.

Implementation notes: honor `prefers-reduced-motion` globally; animate only transform/opacity/clip-path; define spring curves once as CSS custom properties (`--spring-pop: linear(0, 1.4 60%, 1)`); WAAPI for dynamic/particles, CSS transitions for state.

## Key strategic lessons

- Dot died partly because weak proactive suggestions poisoned ALL proactivity. Signal-to-noise IS the product.
- Never re-ask known facts (Martin). Memory made visible as an artifact (Chronicles) > invisible recall.
- The 2026 category split: reactive chat vs always-on background agent with a morning Daily Brief anchor. Donna should be the latter.
- Day One "On This Day": accumulated data must pay compounding dividends — resurface old notes/wins in briefings.
- Opinionated aesthetic (Dot's serif + gradients) makes it feel like a being, not a tool.
