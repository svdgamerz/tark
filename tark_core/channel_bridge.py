"""Universal Multi-Channel Bridge & Webhook Server (OpenClaw Inspired).

Provides:
- Lightweight REST / Webhook HTTP Server on 127.0.0.1:8999
- Endpoints for Chat, Long-Running Goals, Antigravity Auto-Submit, and Health
- Allows external platforms (Mobile apps, Curl, Telegram/Discord webhooks) to control TARK
"""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import threading
from typing import Any, Callable

from tark_core.config import GATEWAY_HOST, GATEWAY_PORT


class ChannelGatewayServer:
    """Manages local REST and Webhook communication channels for TARK."""

    def __init__(
        self,
        chat_handler: Callable[[str], tuple[str, str]],
        goal_handler: Callable[[str], dict[str, Any]],
        goal_status_handler: Callable[[], dict[str, Any] | None],
        autosubmit_handler: Callable[[bool], str],
        host: str = GATEWAY_HOST,
        port: int = GATEWAY_PORT,
    ):
        self.chat_handler = chat_handler
        self.goal_handler = goal_handler
        self.goal_status_handler = goal_status_handler
        self.autosubmit_handler = autosubmit_handler
        self.host = host
        self.port = port
        self.server: HTTPServer | None = None
        self.thread: threading.Thread | None = None

    def start(self) -> None:
        """Starts the gateway HTTP server in a background daemon thread."""
        outer = self

        class GatewayRequestHandler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                # Suppress noisy HTTP request logging in terminal
                pass

            def _send_json(self, status: int, payload: dict[str, Any]):
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode("utf-8"))

            def do_OPTIONS(self):
                self._send_json(200, {"status": "ok"})

            def do_GET(self):
                if self.path in ["/", "/ping", "/health"]:
                    self._send_json(200, {"status": "ONLINE", "assistant": "TARK ULTIMATE", "version": "8.0"})
                elif self.path == "/v1/goal/status":
                    active_goal = outer.goal_status_handler()
                    if active_goal:
                        self._send_json(200, {"active_goal": active_goal})
                    else:
                        self._send_json(200, {"active_goal": None, "message": "No active goals in progress."})
                else:
                    self._send_json(404, {"error": "Not Found"})

            def do_POST(self):
                content_len = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
                try:
                    data = json.loads(body)
                except Exception:
                    data = {}

                if self.path == "/v1/chat":
                    query = data.get("query", "")
                    if not query:
                        self._send_json(400, {"error": "Missing 'query' parameter."})
                        return
                    spoken, display = outer.chat_handler(query)
                    self._send_json(200, {"spoken": spoken, "display": display})

                elif self.path == "/v1/goal":
                    prompt = data.get("prompt", "")
                    if not prompt:
                        self._send_json(400, {"error": "Missing 'prompt' parameter."})
                        return
                    res = outer.goal_handler(prompt)
                    self._send_json(200, res)

                elif self.path == "/v1/autosubmit":
                    enable = data.get("enable", True)
                    msg = outer.autosubmit_handler(enable)
                    self._send_json(200, {"message": msg})

                else:
                    self._send_json(404, {"error": "Endpoint not found."})

        try:
            self.server = HTTPServer((self.host, self.port), GatewayRequestHandler)
            self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
            self.thread.start()
            print(f"  [OPENCLAW GATEWAY]: REST API & Webhook bridge listening on http://{self.host}:{self.port}")
        except Exception as e:
            print(f"  [OPENCLAW GATEWAY ERROR]: Could not bind port {self.port}: {e}")

    def stop(self) -> None:
        if self.server:
            self.server.shutdown()
            self.server.server_close()
