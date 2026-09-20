const fs = require("node:fs");
const { dataPath } = require("./paths");
const path = require("node:path");
const http = require("node:http");

/* Gmail — read-only, via the loopback OAuth flow for the existing "installed"
   client (shift_tracker/client_secret.json). connect() opens Google's consent,
   catches the code on a localhost server, exchanges for a token stored locally
   (data/gmail_token.json). unread() lists recent unread primary messages. All
   local; token never leaves the machine. */

const SECRET = process.env.DONNA_GOOGLE_CLIENT_SECRET || dataPath("google_client_secret.json");
const TOKEN_FILE = dataPath("gmail_token.json");
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

function creds() { const c = JSON.parse(fs.readFileSync(SECRET, "utf8")); return c.installed || c.web; }
function readToken() { try { return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")); } catch { return null; } }
function writeToken(t) { try { fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true }); fs.writeFileSync(TOKEN_FILE, JSON.stringify(t)); } catch {} }
function connected() { return !!readToken(); }
function disconnect() { try { fs.unlinkSync(TOKEN_FILE); } catch {} }

async function exchange(code, redirectUri) {
  const c = creds();
  const body = new URLSearchParams({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error("token exchange " + r.status);
  const t = await r.json(); t.obtained = Date.now(); return t;
}

/* opens consent, resolves once the token is captured + stored */
function connect() {
  return new Promise((resolve, reject) => {
    const c = creds();
    let redirectUri = "";
    const server = http.createServer(async (req, res) => {
      try {
        const code = new URL(req.url, redirectUri).searchParams.get("code");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<body style='font-family:system-ui;background:#0b0b10;color:#eaeaf0;display:grid;place-items:center;height:90vh'><div style='text-align:center'><h2>✓ Donna is connected to Gmail</h2><p style='color:#9a9aa8'>You can close this tab.</p></div></body>");
        server.close();
        if (!code) return reject(new Error("no code"));
        writeToken(await exchange(code, redirectUri));
        resolve(true);
      } catch (e) { reject(e); }
    });
    server.listen(0, "127.0.0.1", () => {
      redirectUri = `http://localhost:${server.address().port}`;
      const url = `${c.auth_uri || "https://accounts.google.com/o/oauth2/auth"}?client_id=${encodeURIComponent(c.client_id)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(SCOPE)}&access_type=offline&prompt=consent`;
      try { require("electron").shell.openExternal(url); } catch {}
    });
    setTimeout(() => { try { server.close(); } catch {} reject(new Error("timeout")); }, 180000);
  });
}

async function accessToken() {
  const t = readToken(); if (!t) return null;
  const stale = Date.now() - (t.obtained || 0) > ((t.expires_in || 3600) - 120) * 1000;
  if (stale && t.refresh_token) {
    const c = creds();
    const body = new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: t.refresh_token, grant_type: "refresh_token" });
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (r.ok) { const nt = await r.json(); t.access_token = nt.access_token; t.expires_in = nt.expires_in; t.obtained = Date.now(); writeToken(t); }
  }
  return t.access_token;
}

async function unread() {
  const at = await accessToken(); if (!at) return { ok: false };
  try {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+category:primary&maxResults=8", { headers: { Authorization: "Bearer " + at } });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    const items = [];
    for (const m of (d.messages || []).slice(0, 6)) {
      const mr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, { headers: { Authorization: "Bearer " + at } });
      if (mr.ok) { const md = await mr.json(); const h = (n) => ((md.payload.headers || []).find((x) => x.name === n) || {}).value || ""; items.push({ from: h("From").replace(/<.*>/, "").trim(), subject: h("Subject") }); }
    }
    return { ok: true, count: d.resultSizeEstimate || items.length, items };
  } catch { return { ok: false }; }
}

module.exports = { connect, unread, connected, disconnect };
