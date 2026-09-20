/* demo.js — pre-populate Donna with generic example data so the first-run
   experience is alive. Idempotent (checks if data exists before adding).
   Useful for trying Donna out. */

const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");
const tasks = require("./tasks");
const goals = require("./goals");
const notes = require("./notes");
const waiting = require("./waiting");
const ideas = require("./ideas");
const capture = require("./captureStore");

const TASKS_FILE = dataPath("tasks.json");

function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; } }
function writeJson(p, d) { try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 2)); } catch {} }

function ensureDemo() {
  let added = 0;
  /* goals — if no active goal, add 2 */
  if (goals.list().filter((g) => !g.done).length === 0) {
    const id1 = goals.add("Get consistently organised", "A calm system beats a busy to-do list — build the habit first.", "work");
    goals.update(id1, { oneThing: "Clear the inbox and the task list every morning this week" });
    goals.add("Move for 30 minutes every day", "Energy compounds. So does the opposite.", "health");
    added += 2;
  }
  /* tasks — if empty, add 6 */
  if (tasks.summary().open.length === 0) {
    tasks.add("Write the weekly update p1 tomorrow @work =1h");
    tasks.add("Email Sam about the invoice p2 @work");
    tasks.add("Book the dentist appointment p2 @life =15m");
    tasks.add("Plan next week p1 friday @work =30m");
    tasks.add("Read 20 pages p3 anytime @life =30m");
    tasks.add("Tidy the desk p3 @life =20m");
    added += 6;
  }
  /* waiting — if empty, add 3 */
  if (waiting.list().length === 0) {
    waiting.add("Invoice payment", "sam");
    waiting.add("Contract review", "legal");
    waiting.add("Design files", "maya");
    added += 3;
  }
  /* notes — if empty, add 2 */
  if (notes.list().length === 0) {
    notes.add("How I like to work", "Deep work in the morning, admin after lunch, nothing heavy after 7pm. One priority per day beats ten quick wins.");
    notes.add("Weekly review checklist", "1. Clear inbox and task list. 2. Review goals and key results. 3. Pick next week's one big thing. 4. Book time for it.");
    added += 2;
  }
  /* ideas — if empty, add 3 */
  if (ideas.list().length === 0) {
    ideas.add("A short daily note format I'd actually keep", "writing");
    ideas.add("A 20-minute weekly planning ritual", "productivity");
    ideas.add("A simple way to track habits without guilt", "health");
    added += 3;
  }
  /* capture — if empty, add 2 */
  if (capture.list().length === 0) {
    capture.add("note", "Insight: the fastest wins are the tasks you were overthinking. Cut first, polish after.");
    capture.add("todo", "Try time-blocking tomorrow morning and see how it feels");
    added += 2;
  }
  return added;
}

module.exports = { ensureDemo };
