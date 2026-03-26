#!/usr/bin/env python3
import json, os, subprocess, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOME = os.path.expanduser("~")
APP_DIR = os.path.join(HOME, "sharat-raz")
CONTROL_DIR = os.path.join(HOME, "my-assistant")
STATE_DIR = os.path.join(CONTROL_DIR, "STATE")
NEXT_FILE = os.path.join(STATE_DIR, "NEXT_COMMAND.json")
LAST_FILE = os.path.join(STATE_DIR, "LAST_RESULT.json")
BUTTONS_FILE = os.path.join(APP_DIR, "CONTROL", "buttons.json")
HEALTH_FILE = os.path.join(APP_DIR, "CONTROL", "system_health.json")
DIAG_FILE = os.path.join(APP_DIR, "reports", "runtime_diagnostics.json")
API_PORT = 8791

os.makedirs(STATE_DIR, exist_ok=True)

def read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def run(cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)

def normalize_target(value):
    v = (value or "").strip().lower()
    if v in ("pc", "salon", "living-room", "living-room-pc", "מחשב סלון"):
        return "pc"
    if v in ("room-pc", "computer-room", "מחשב חדר מחשב"):
        return "room-pc"
    if v in ("n8n",):
        return "n8n"
    if v in ("wol", "wake", "wake_salon", "הדלק מחשב"):
        return "wol"
    return v

def git_sync_queue():
    steps = []
    try:
        steps.append(run(["git","pull","--rebase"], cwd=CONTROL_DIR))
        steps.append(run(["git","add","STATE/NEXT_COMMAND.json"], cwd=CONTROL_DIR))
        steps.append(run(["git","commit","-m","sharat-raz: queue command"], cwd=CONTROL_DIR))
        steps.append(run(["git","push"], cwd=CONTROL_DIR))
    except Exception:
        pass
    return [{"code": x.returncode, "stdout": x.stdout[-300:], "stderr": x.stderr[-300:]} for x in steps]

class H(BaseHTTPRequestHandler):
    def _send(self, code=200, payload=None):
        raw = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self._send(200, {"ok": True})

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "service": "sharat-raz-api", "port": API_PORT, "ts": time.time()})

        if self.path == "/buttons":
            return self._send(200, {"ok": True, "buttons": read_json(BUTTONS_FILE, {})})

        if self.path == "/status":
            return self._send(200, {
                "ok": True,
                "health": read_json(HEALTH_FILE, {}),
                "diagnostics": read_json(DIAG_FILE, {}),
                "last_result": read_json(LAST_FILE, {}),
                "next_command": read_json(NEXT_FILE, {})
            })

        return self._send(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        if self.path != "/command":
            return self._send(404, {"ok": False, "error": "not_found"})
        try:
            length = int(self.headers.get("Content-Length","0"))
            body = self.rfile.read(length).decode("utf-8")
            data = json.loads(body) if body else {}
        except Exception as e:
            return self._send(400, {"ok": False, "error": "bad_json", "detail": str(e)})

        target = normalize_target(data.get("target"))
        action = (data.get("action") or "").strip()
        params = data.get("params") or {}

        if target not in ("pc", "room-pc", "n8n", "wol"):
            return self._send(400, {"ok": False, "error": "bad_target", "got": target})
        if not action:
            return self._send(400, {"ok": False, "error": "missing_action"})

        payload = {
            "request_id": str(uuid.uuid4()),
            "command": "run",
            "target": target,
            "action": action,
            "params": params,
            "status": "pending",
            "source": "sharat-raz"
        }

        write_json(NEXT_FILE, payload)
        git_steps = git_sync_queue()
        return self._send(200, {"ok": True, "queued": payload, "git": git_steps})

def main():
    server = ThreadingHTTPServer(("127.0.0.1", API_PORT), H)
    print(f"sharat-raz-api listening on 127.0.0.1:{API_PORT}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    main()
