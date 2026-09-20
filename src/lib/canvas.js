const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");

/* Canvas — an edgeless spatial board (AFFiNE / Miro), local-first. Everything
   Donna already has is a list; this is the one surface where you spread ideas
   out in space — map a launch, arrange reel concepts, mind-map a niche. Boards
   act as tabs; each holds free-floating cards with a world x/y position, so
   the board pans and zooms while cards keep their place. Pure local JSON. */

const FILE = dataPath("canvas.json");

const DEFAULT = {
  boards: [{
    id: "b_start", name: "First board", createdAt: new Date(0).toISOString(),
    cards: [
      { id: "c_1", x: 120, y: 100, w: 220, h: 96, color: "signal", text: "Double-click anywhere to drop a card. Drag to move. This is your thinking space." },
      { id: "c_2", x: 380, y: 240, w: 200, h: 88, color: "amber", text: "Map a launch, arrange reel hooks, sketch a funnel — spread it out." },
    ],
  }],
};

const read = () => { try { const d = JSON.parse(fs.readFileSync(FILE, "utf8")); return d && Array.isArray(d.boards) && d.boards.length ? d : DEFAULT; } catch { return DEFAULT; } };
const write = (d) => { try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(d)); } catch {} };

function get() { return read(); }

function addBoard(name) {
  const d = read();
  const b = { id: `b_${Date.now()}`, name: (name || "New board").slice(0, 40), createdAt: new Date().toISOString(), cards: [] };
  d.boards.push(b); write(d);
  return b.id;
}
function renameBoard(id, name) {
  const d = read(); const b = d.boards.find((x) => x.id === id);
  if (b) { b.name = (name || b.name).slice(0, 40); write(d); }
  return !!b;
}
function removeBoard(id) {
  const d = read();
  d.boards = d.boards.filter((x) => x.id !== id);
  if (!d.boards.length) d.boards = JSON.parse(JSON.stringify(DEFAULT.boards));
  write(d);
  return d.boards[0].id;
}
/* upsert a whole board (renderer owns the interaction, sends the full board on
   change — debounced during drags). Cheap: boards are small. */
function saveBoard(board) {
  if (!board || !board.id) return false;
  const d = read();
  const i = d.boards.findIndex((x) => x.id === board.id);
  board.cards = (board.cards || []).slice(0, 500);
  if (i >= 0) d.boards[i] = board; else d.boards.push(board);
  write(d);
  return true;
}

module.exports = { get, addBoard, renameBoard, removeBoard, saveBoard };
