/* sections.js — the visibility model for every page + strip in Donna.
   One source of truth so Settings, the sidebar, and every view render agree
   on what's on. Defaults = everything on.
   Per-section toggles let him hide what he doesn't use, in groups, without
   breaking nav or deep-links (a hidden page just isn't in the sidebar;
   ⌘1-9 still works if you know the slot). */

/* Sections registry. Add a new entry when you add a page or a strip.
   group: "nav" for sidebar items, "today" / "tasks" / "goals" / etc for
   in-page strips, "settings" for setting sub-tabs. */
const SECTIONS = [
  /* nav pages */
  { id: "page.today",      label: "Today",         group: "nav", desc: "Home — hero task, lead action, week, brief", default: true },
  { id: "page.plan",       label: "Plan",          group: "nav", desc: "Auto-scheduled timeline + Week view of what's coming", default: true },
  { id: "page.tasks",      label: "Tasks",         group: "nav", desc: "List + Board of every open task, sortable by priority / due / project", default: true },
  { id: "page.ask",        label: "Ask",           group: "nav", desc: "The AI hub — chat, memory, jump-starts", default: true },
  { id: "page.rhythm",     label: "Tracker",       group: "nav", desc: "What you actually did today: focus, deep work, screenshots, Pulse", default: true },
  { id: "page.library",    label: "Notes",         group: "nav", desc: "Notes, ideas and quick captures", default: true },
  { id: "page.people",     label: "People",        group: "nav", desc: "Your circle, cadence, and what they owe you", default: true },
  { id: "page.habits",     label: "Habits",        group: "nav", desc: "Daily routines, streaks and identity votes", default: true },
  { id: "page.goals",      label: "Goals",         group: "nav", desc: "OKR + 12-Week Year objectives, key results, milestones, lead measure", default: true },
  { id: "page.settings",   label: "Settings",      group: "nav", desc: "Configure Donna", default: true },

  /* AI Coach — contextual ✦ button on every page. Lives in its own group so
     Settings' "sections" tab can hide it independently of the per-page strips. */
  { id: "ai.coach",        label: "AI coach on every page", group: "ai", desc: "Contextual ✦ button on every page that suggests smart moves", default: true },

  /* Today strips */
  { id: "today.brief",     label: "AI morning brief",     group: "Today", desc: "One AI sentence on how to start the day", default: true },
  { id: "today.lead",      label: "This week's lead",     group: "Today", desc: "Top goal's oneThing as a focused strip", default: true },
  { id: "today.week",      label: "Week lead-measure",    group: "Today", desc: "X/Y committed actions done across active goals", default: true },
  { id: "today.nudge",     label: "Smart nudge",          group: "Today", desc: "One contextual suggestion from real state", default: true },
  { id: "today.also",      label: "Also on your plate",   group: "Today", desc: "Next 3 priorities below the hero", default: true },
  { id: "today.routines",  label: "Routines",             group: "Today", desc: "Daily non-negotiables checklist", default: true },
  { id: "today.reminders", label: "Reminders",            group: "Today", desc: "Upcoming reminders strip", default: true },
  { id: "today.waiting",   label: "Waiting on others",    group: "Today", desc: "Who owes you what — stale and alert timers", default: true },
  { id: "today.diagnostic", label: "Boot diagnostic",      group: "Today", desc: "Silent-issue radar (tracker perm, stale goals, alerts)", default: true },
  { id: "today.sleep",      label: "Sleep chip",          group: "Today", desc: "Last night's sleep + 7-day average", default: true },

  /* Compact mode — the docked panel. Each card is a separate toggle. */
  { id: "compact.lead",      label: "Lead action card",    group: "Compact", desc: "This week's lead (the goal's oneThing)", default: true },
  { id: "compact.now",       label: "Now-focusing card",   group: "Compact", desc: "Live timer + done/pause for the task you're on", default: true },
  { id: "compact.pipeline",  label: "Pipeline card",       group: "Compact", desc: "Voice-swap + ready + post-ready counts", default: true },
  { id: "compact.priorities", label: "Priorities card",    group: "Compact", desc: "Up next / top 4 priorities", default: true },

  /* Pill mode — the menu-bar chip. One toggle to hide. */
  { id: "pill.show",         label: "Pill mode",           group: "Compact", desc: "Tiny menu-bar chip (lead action + status dot)", default: true },
];

const STORE_KEY = "donna.sections";
const _overrides = (() => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; } })();

function isOn(id) {
  const sec = SECTIONS.find((s) => s.id === id);
  if (!sec) return true; // unknown section = on
  return _overrides[id] !== undefined ? !!_overrides[id] : !!sec.default;
}
function toggle(id) { setOn(id, !isOn(id)); return isOn(id); }
function setOn(id, val) {
  _overrides[id] = !!val;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(_overrides)); } catch {}
  try { window.dispatchEvent(new CustomEvent("donna:sections", { detail: { id, on: !!val } })); } catch {}
}
function all(group) { return SECTIONS.filter((s) => !group || s.group === group); }
function isOnGroup(prefix) { return SECTIONS.some((s) => s.id.startsWith(prefix) && isOn(s.id)); }

/* Used by the shell on boot to remove nav items that are off. */
function visibleNavIds() {
  return SECTIONS.filter((s) => s.group === "nav" && isOn(s.id)).map((s) => s.id.replace(/^page\./, ""));
}

const _exports = { SECTIONS, isOn, toggle, setOn, all, isOnGroup, visibleNavIds };
if (typeof module !== "undefined" && module.exports) module.exports = _exports;
if (typeof window !== "undefined") window.sections = _exports;
