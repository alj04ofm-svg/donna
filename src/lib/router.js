const CREATIVE = /\b(write|script|hook|caption|rewrite|brainstorm|copy|angle|story|slogan)\b/i;
const IMPORTANT = /\b(analy[sz]e|decide|decision|should i|why|compare|trade-?off|evaluate|recommend|strateg|review|worth it|pros and cons)\b/i;
function route(input) {
  const t = input.trim();
  let m;
  if ((m = t.match(/^quick:\s*(.+)/is))) return { tier: "m3", text: m[1].trim() };
  if ((m = t.match(/^think:\s*(.+)/is))) return { tier: "opus", text: m[1].trim() };
  if ((m = t.match(/^best:\s*(.+)/is))) return { tier: "fable", text: m[1].trim() };
  if (CREATIVE.test(t)) return { tier: "fable", text: t };
  if (IMPORTANT.test(t)) return { tier: "opus", text: t };
  return { tier: "m3", text: t }; // M3 is the everyday default — very capable
}
module.exports = { route };
