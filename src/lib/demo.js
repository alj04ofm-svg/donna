/* demo.js — pre-populate Donna with realistic example data so the
   first-run experience is alive. Idempotent (checks if data exists
   before adding). Useful for: new users, demos, onboarding. */

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
    const id1 = goals.add("30 World Cup reels live", "Prove the machine runs end-to-end so the agency compounds without me babysitting it", "work");
    goals.update(id1, { oneThing: "Lock the script bank + ship one full end-to-end pipeline today" });
    goals.add("8 accounts posting daily", "Distribution = leverage. Every account is a revenue surface.", "money");
    added += 2;
  }
  /* tasks — if empty, add 6 */
  if (tasks.summary().open.length === 0) {
    tasks.add("Ship WC reel #4 p1 tomorrow #worldcup @work =2h >>world cup");
    tasks.add("Chase george about ElevenLabs invoice p2 @relationships");
    tasks.add("QC pass on new reels p1 today @work =45m");
    tasks.add("Review herdr agent outputs p3 anytime @work");
    tasks.add("Post to the 8 accounts =2h today @work");
    tasks.add("Build Donna v2 onboarding tour p2 =90m");
    added += 6;
  }
  /* waiting — if empty, add 3 */
  if (waiting.list().length === 0) {
    waiting.add("ElevenLabs invoice pay", "george");
    waiting.add("Apify credits top-up", "george");
    waiting.add("Final WC script pass", "editor");
    added += 3;
  }
  /* notes — if empty, add 2 */
  if (notes.list().length === 0) {
    notes.add("Anastasia 1.0 voice rules", "1. Use 'ng' never 'ing'. 2. End every sentence like a question or a tease. 3. 0.85x speed. 4. Always use 'babe' or 'babes' for address.");
    notes.add("Production cadence", "Reels batched 3 at a time. Voice-swap on Mon/Wed/Fri. QC on Tue/Thu. Post peaks at 7pm. Rest on weekends.");
    added += 2;
  }
  /* ideas — if empty, add 3 */
  if (ideas.list().length === 0) {
    ideas.add("Pov: your ex is about to text you back", "gossip");
    ideas.add("Three things every girl does when she's obsessed", "gossip");
    ideas.add("A 3am voice note from me to you", "gossip");
    added += 3;
  }
  /* capture — if empty, add 2 */
  if (capture.list().length === 0) {
    capture.add("note", "Insight: the reels that ship fastest are the ones with the shortest script. Cut first, polish after.");
    capture.add("todo", "Try the new kling 2.6 model for batch WC #5-#8");
    added += 2;
  }
  return added;
}

module.exports = { ensureDemo };
