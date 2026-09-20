# UI Blueprints — competitor-grade redesign per page (2026-07-07)

From 4 parallel Sonnet R&D agents. Headline moves per page. Full details in session; this is the durable build reference. Design system: void-dark, hue-250 neutrals, ONE blue signal accent, p1=red p2=amber ok=green; domain hues work=250 money=85 health=160 relationships=25. Fonts Syne/Geist/JetBrains Mono. `.view` centered 780px, `.view.wide` 1120px.

## DAILY DRIVERS (mostly validated — targeted refinements)
- **Today** (Sunsama/Notion Home/Things): keep single-hero focus; 588px focused column; ONE bordered surface (hero); tight vertical rhythm; accent only on hero border/go-button/brief/nudge. Already close.
- **Tasks** (Things activation-states + Linear density): **STICKY header+quick-add control bar** so add-input never scrolls away. Now section = only tinted section. Hover-reveal row actions. Triage pill ≥3 untriaged.
- **Plan** (Structured now-line): ALREADY MATCHES — compressed-past strip, now-anchored timeline, capacity cells, priority-colored blocks. Done.
- **Capture** (Superhuman speed): big hero input (56px, autofocus), kind color todo=signal/note=muted, reverse-chron stream w/ opacity decay, relative time, later route-actions →Idea/→Note/→Waiting on hover.
- **Ask** (ChatGPT empty-state + Superhuman prefixes): ALREADY GOOD — context-aware chips from live tasks, model prefixes visible. Leave.

## ANALYTICS/OPS (transformative)
- **Tracker** (RescueTime 3-zone + WHOOP tiers + Timing timeline): hero = **Pulse ring that shifts color ok→amber→red as score falls** (not static blue) + delta-vs-yesterday under it; 5-cell stat strip beside; full-width **category day-timeline** (idle=hatch not blank, click→evidence drawer w/ screenshot + AI caption); 14-day **stacked** sparkline (segmented by category, today outlined); "where time went" category bars largest-first w/ ONE color key; top-apps table + focus-sessions list 2-col; screenshots grid collapsed last. **100x: "Reality Check" chip** — if Pulse high but longest session tiny, flip to red "you're fragmenting not focusing".
- **Production** (funnel-bars + Linear board + Height table): **4-stage stat-cells with capacity bars + colored flow-arrows** (green healthy / red bottleneck / amber trickle) between them; **"Next Unblock" computed banner** under header; voice-gate + agents 2-col; post-ready table sortable w/ own scroll cap. "mirrored from Agency OS · Nm ago" caption. Empty gate = green "gate clear".

## GROWTH (de-sparse; rich)
- **Goals** (12WY weekly-score-primary + Streaks fusion): **quarter strip** (12 week-ticks, current outlined) above list kills empty space; collapsed goal-row = ring + **7-dot week strip** + one-line meta (domain·KRfraction·next-milestone) + next-action; expanded = 2-col (Why+KRs left / "⚡The Lever" amber callout + milestones + weekly-ring right). Streak badge at 3+ weeks. Quarter strip always present even at 0 goals.
- **Life** (radar wheel + Oura trend + linked goals): **HERO = SVG radar/spider chart** 320px, 4 axes (work12/money3/health6/rel9), multi-hue polygon + dashed 30-days-ago ghost polygon; 2×2 cards demoted below (small ring + 12-wk sparkline + trend arrow + **linked-goals chips** or "+ set a goal" CTA); **footer Balance Score** + auto-insight ("Health drags your avg down 1.2"). Kills sparseness via radar hero + footer + per-domain CTAs.
- **Rhythm** (Streaks ring + GitHub heatmap + Atoms votes): keystone hero 2-col (identity italic + 40px streak number w/ ring | **7-box this-week row** + mark-done); **monthly heatmap** (GitHub 4-intensity, aggregates ALL habits); replacement loops as horizontal old→new(green) cards w/ streak; **footer "247 votes cast this month"** identity ledger. Week-boxes = squares (calendar language).

## LIBRARY/CRM
- **People** (Clay warmth-corner + Dex): header stat strip (Total·Overdue·Due-week·On-track) + sort toggle; drifting banner if any overdue; 2-col cards, coldest first; card = avatar+name+role · warmth ring top-right (green→amber→red by cadence%) · cadence line · inline notes · "Talked today" (logs timestamp into notes). 3-tier warmth.
- **Notes** (Bear flat+tags + Apple gallery): quick-add capture-first (first line=title); auto `#tag` chips filter row if >8; reverse-chron cards collapse(title+preview+date)→expand(edit title+body, delete confirm-in-place). No folders.
- **Ideas** (Milanote bank + Linear hover-actions): stat strip (total·used·by-niche); quick-add + niche chip-picker; 2-col dense cards, niche chip color-coded (3 fixed niche colors app-wide); hover actions →Task/✓Used(dims+demotes, keeps swipe-file)/✕. "Hide used" default on.
- **Memory** (mem.ai ambient + Notion chips): stat strip (total·this-week·kinds); group-by-kind default; dense ROWS not cards (kind chip 96px col + inline-edit fact + source/date receipts + "auto" dot for AI-mined). Kinds muted 15%-fills.
- **Waiting** (Things waiting-for + Linear triage): stat strip (total·stale·resolved-wk); oldest-first; dense rows: **3-tier age chip** (grey→amber 5-7d→red 8d+) + item + who-chip(shared w/ People) + "back to me" (1-click, slide-out). Empty = green "nothing blocked".
- **Comms** (Superhuman split-inbox reduced): 3 stacked cards; icon + name/desc + status badge (green/grey/amber "needs re-auth") + connect/disconnect swap. Capped at 3, no "browse more".
- **Capture**: see daily.

## IMPLEMENTATION ORDER (by visible impact × user complaints)
1. Library/CRM refinements (broad, contained): Capture ✓, Tasks sticky, People, Waiting, Memory, Notes, Ideas
2. Life radar hero (specific complaint about sparseness)
3. Tracker Pulse ring + timeline
4. Goals collapsed-row + quarter strip
5. Rhythm heatmap + votes
6. Production funnel diagnostics
