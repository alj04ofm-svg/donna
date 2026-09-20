const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* People — a light CRM for the people in your life. Per person: role +
   running notes + how many Waiting-On items are on them, so it doubles as
   "who owes me what". */

const FILE = dataPath("people.json");
const DEFAULTS = [];
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return DEFAULTS; } };
const write = (a) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(a)); } catch {} };

/* drift radar (Clay/Dex/Monica): each person has a contact cadence; warmth
   decays as days-since-contact approaches it. drifting = past cadence. */
function list() {
  let waiting = [];
  try { waiting = require("./waiting").list(); } catch {}
  const now = Date.now();
  return read().map((p) => {
    const cadence = p.cadenceDays || 7;
    const days = p.lastContactAt ? Math.floor((now - new Date(p.lastContactAt)) / 86400000) : null;
    const warmth = days === null ? null : Math.max(0, Math.min(100, Math.round(100 - (days / cadence) * 100)));
    return {
      ...p, cadenceDays: cadence, daysSince: days, warmth,
      drifting: days !== null && days >= cadence,
      waitingCount: waiting.filter((w) => (w.who || "").toLowerCase() === p.name.toLowerCase()).length,
      staleCount: waiting.filter((w) => (w.who || "").toLowerCase() === p.name.toLowerCase() && w.stale).length,
    };
  });
}
function update(id, patch) { const a = read(); const p = a.find((x) => x.id === id); if (p) { Object.assign(p, patch); write(a); } return !!p; }
function touch(id) {
  const ok = update(id, { lastContactAt: new Date().toISOString() });
  try { const a = read(); const p = a.find((x) => x.id === id); if (p) require("./activity").log("person_touched", p.name, { domain: "relationships", ref: { type: "person", id } }); } catch {}
  return ok;
}
const TYPES = ["Work", "Client", "Partner", "Friend", "Family"];

function add(name, role, type) {
  const a = read();
  const p = { id: `p_${Date.now()}`, name: name || "New person", role: role || "", type: type || "", notes: "" };
  a.push(p); write(a);
  try { require("./activity").log("person_added", p.name + (p.role ? ` · ${p.role}` : ""), { domain: "relationships", ref: { type: "person", id: p.id } }); } catch {}
  return p;
}

module.exports = { list, update, touch, add };
