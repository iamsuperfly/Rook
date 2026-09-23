#!/usr/bin/env python3
"""Tiny HTTP wrapper around crew.py for a remote worker (Replit Deployment).

GET  /health  → {ok:true}
POST /debate  → Judge JSON text (same payload Next.js already sends on stdin)

Auth: if CREW_HTTP_SECRET is set, require Authorization: Bearer <secret>.
If the secret is unset, POST is rejected so a public URL cannot be abused.
"""

from __future__ import annotations

import json
import os
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local")
load_dotenv()

from crew import run_crew  # noqa: E402

PORT = int(os.getenv("PORT", os.getenv("CREW_HTTP_PORT", "5000")))
SECRET = (os.getenv("CREW_HTTP_SECRET") or "").strip()


def authorized(handler: BaseHTTPRequestHandler) -> bool:
    if not SECRET:
        return False
    got = handler.headers.get("Authorization") or handler.headers.get("X-Crew-Secret") or ""
    if got.startswith("Bearer "):
        got = got[7:]
    return got == SECRET


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("[crew-http] " + (fmt % args) + "\n")

    def _send(self, code: int, body: str, content_type: str = "application/json") -> None:
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", content_type)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.split("?", 1)[0] in ("/", "/health"):
            self._send(200, json.dumps({"ok": True, "engine": "rook-crew"}))
            return
        self._send(404, json.dumps({"error": "not_found"}))

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path != "/debate":
            self._send(404, json.dumps({"error": "not_found"}))
            return
        if not authorized(self):
            self._send(401, json.dumps({"error": "unauthorized"}))
            return
        length = int(self.headers.get("content-length") or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            self._send(400, json.dumps({"error": "bad_json"}))
            return
        symbol = str(payload.get("symbol") or "BTCUSDT").upper()
        horizon = str(payload.get("horizon") or "7d")
        side = str(payload.get("side") or "decide")
        snapshot = payload.get("snapshot")
        try:
            text = run_crew(symbol, horizon, side, snapshot)
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            self._send(500, json.dumps({"error": "crew_failed", "detail": str(exc)[:400]}))
            return
        self._send(200, text if text.endswith("\n") else text + "\n", "application/json")


def main() -> None:
    if not SECRET:
        print("CREW_HTTP_SECRET is required before serving POST /debate", flush=True)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"crew http listening on {PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
