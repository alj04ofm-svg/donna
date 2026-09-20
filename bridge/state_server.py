#!/usr/bin/env python3
"""Donna Bridge — the operation's live state API.

One read-only endpoint (GET /state) that aggregates everything Donna needs to
know what's actually happening right now: the reel pipeline (with honest
per-source freshness so stale files can't masquerade as live), the shared task
store, and a live proxy of the UGC dashboard's OPEN endpoints (/api/health,
/api/editing-status on :3050). Nothing is written; nothing leaves the machine.

Run:  python3 bridge/state_server.py           (defaults to :8091)
      DONNA_BRIDGE_PORT=8091 python3 ...        (override port)
Donna's main process spawns this on boot; production.js consumes /state.
"""
import json, os, time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import urlopen

UGC = "/Users/cam/Desktop/ALJ-HOME/UGC"
LAUNCH = os.path.join(UGC, "work/launch_v2")
GEN_READY = os.path.join(LAUNCH, "GENERATION_READY.json")
GENERATED = os.path.join(LAUNCH, "_genqueue/GENERATED.json")
POST_NOW = os.path.join(UGC, "POST_NOW")
TASKS = os.path.join(UGC, "work/staff/tasks.json")
DASH = "http://localhost:3050"
PORT = int(os.environ.get("DONNA_BRIDGE_PORT", "8091"))


def _now():
    return datetime.now(timezone.utc).isoformat()


def _mtime(path):
    try:
        t = os.path.getmtime(path)
        return {"iso": datetime.fromtimestamp(t, timezone.utc).isoformat(),
                "age_hours": round((time.time() - t) / 3600, 1)}
    except OSError:
        return None


def _read_json(path, fallback):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return fallback


def _count_mp4(d):
    try:
        return len([f for f in os.listdir(d) if f.endswith(".mp4")])
    except OSError:
        return 0


def _pipeline():
    gr = _read_json(GEN_READY, {"reels": []})
    reels = gr.get("reels", []) if isinstance(gr, dict) else []
    by_niche = {}
    for r in reels:
        k = (r.get("niche") or "other")
        by_niche[k] = by_niche.get(k, 0) + 1

    gen_present = os.path.exists(GENERATED)
    gen = _read_json(GENERATED, [])
    gen_n = len(gen) if isinstance(gen, list) else 0

    voice_dir = os.path.join(POST_NOW, "_NEEDS_VOICE_SWAP")
    try:
        voice = [f[:-4] for f in os.listdir(voice_dir) if f.endswith(".mp4")]
    except OSError:
        voice = []

    accounts = []
    try:
        for d in os.listdir(POST_NOW):
            if d.startswith("@"):
                n = _count_mp4(os.path.join(POST_NOW, d))
                if n:
                    accounts.append({"account": d, "count": n})
    except OSError:
        pass
    accounts.sort(key=lambda a: -a["count"])
    post_n = sum(a["count"] for a in accounts)

    ready_fresh = _mtime(GEN_READY)
    stale = ready_fresh["age_hours"] > 24 if ready_fresh else True
    return {
        "ready": {"n": len(reels), "by_niche": by_niche, "as_of": ready_fresh, "stale": stale},
        "generated": {"n": gen_n, "present": gen_present},
        "voice_swap": {"n": len(voice), "files": voice[:20]},
        "post_ready": {"n": post_n, "accounts": accounts, "as_of": _mtime(POST_NOW)},
    }


def _tasks():
    d = _read_json(TASKS, {"tasks": []})
    tasks = d.get("tasks", []) if isinstance(d, dict) else []
    today = datetime.now().strftime("%Y-%m-%d")
    open_t = [t for t in tasks if t.get("status") != "done"]
    done_today = [t for t in tasks if t.get("status") == "done" and (t.get("updatedAt") or "")[:10] == today]
    return {
        "open": len(open_t),
        "p1": len([t for t in open_t if t.get("priority") == 1]),
        "done_today": len(done_today),
        "as_of": _mtime(TASKS),
    }


def _dashboard():
    out = {"up": False, "health": None, "editing": None}
    for ep, key in (("/api/health", "health"), ("/api/editing-status", "editing")):
        try:
            with urlopen(DASH + ep, timeout=3) as r:
                out[key] = json.loads(r.read().decode())
                out["up"] = True
        except Exception:
            pass
    return out


def state():
    return {"ts": _now(), "pipeline": _pipeline(), "tasks": _tasks(), "dashboard": _dashboard()}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass  # quiet

    def do_GET(self):
        if self.path.rstrip("/") in ("/state", ""):
            body = json.dumps(state()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        # port already in use → another bridge is serving; exit quietly
        raise SystemExit(0)
    print(f"[donna-bridge] serving live state on http://localhost:{PORT}/state", flush=True)
    srv.serve_forever()
