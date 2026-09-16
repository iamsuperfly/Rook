"""Call official bitget-signal public MCP (no API key)."""

from __future__ import annotations

import json
import os
from typing import Any

import requests

MCP_URL = os.getenv("BITGET_SIGNAL_MCP", "https://datahub.noxiaohao.com/mcp")


def _parse_sse(text: str) -> Any:
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("data:"):
            raw = line[5:].strip()
            if raw:
                return json.loads(raw)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _rpc(method: str, params: dict[str, Any], session: str | None = None) -> tuple[str | None, Any]:
    headers = {
        "content-type": "application/json",
        "accept": "application/json, text/event-stream",
    }
    if session:
        headers["mcp-session-id"] = session
    res = requests.post(
        MCP_URL,
        headers=headers,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=12,
    )
    sid = res.headers.get("mcp-session-id") or session
    return sid, _parse_sse(res.text)


def _tool_text(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    result = body.get("result") or {}
    content = result.get("content") if isinstance(result, dict) else None
    if isinstance(content, list):
        return "\n".join(str(c.get("text", "")) for c in content if isinstance(c, dict)).strip()
    try:
        return json.dumps(result or body)[:4000]
    except TypeError:
        return ""


def collect_signal_brief(symbol: str) -> str:
    try:
        sid, _ = _rpc(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "rook-crew", "version": "1.0.0"},
            },
        )
        parts: list[str] = []
        _, sent = _rpc("tools/call", {"name": "sentiment_index", "arguments": {"action": "current"}}, sid)
        t = _tool_text(sent)
        if t:
            parts.append("SENTIMENT\n" + t[:800])
        _, news = _rpc("tools/call", {"name": "tradfi_news", "arguments": {"action": "crypto_news", "limit": 8}}, sid)
        n = _tool_text(news)
        if n and "FINNHUB_API_KEY" not in n and "error" not in n.lower():
            parts.append("NEWS\n" + n[:1200])
        if not parts:
            return "no external headlines available"
        return f"bitget-signal MCP ({MCP_URL})\nsymbol {symbol}\n\n" + "\n\n".join(parts)
    except Exception:
        return "no external headlines available"
