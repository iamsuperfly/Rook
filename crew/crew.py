#!/usr/bin/env python3
"""Rook CrewAI engine. Official OSS CrewAI + Groq + bitget-signal MCP.

Usage:
  python crew.py BTCUSDT 7d decide
  echo '{"symbol":"BTCUSDT","horizon":"7d","side":"decide","snapshot":{}}' | python crew.py --json
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local")
load_dotenv()

from signal_mcp import collect_signal_brief  # noqa: E402

BITGET = os.getenv("BITGET_BASE", "https://api.bitget.com")
MODEL_A = os.getenv("GROQ_MODEL_A", "openai/gpt-oss-20b")
MODEL_B = os.getenv("GROQ_MODEL_B", "openai/gpt-oss-120b")

JUDGE_SCHEMA = """
{
  "symbol": "BTCUSDT",
  "horizon": "7d",
  "bias": "long | short | none",
  "confidence": 0,
  "strategy": "2-5 sentences",
  "bull_summary": "",
  "bear_summary": "",
  "catalysts": [],
  "risks": [],
  "i_am_wrong_if": [],
  "invalidation_price": null,
  "invalidation_note": "",
  "action": "watch | reject | call_off | hold",
  "reason": "",
  "evidence_quality": 0
}
"""


def scout(symbol: str) -> dict:
    url = f"{BITGET}/api/v2/spot/market/tickers?symbol={symbol}"
    res = requests.get(url, timeout=10)
    body = res.json()
    if body.get("code") != "00000" or not body.get("data"):
        alt = symbol if symbol.startswith("R") else f"R{symbol.replace('USDT', '')}USDT"
        if alt != symbol:
            return scout(alt)
        raise SystemExit(f"ticker not found: {symbol}")
    row = body["data"][0]
    return {
        "symbol": row.get("symbol", symbol),
        "last": float(row["lastPr"]),
        "bid": row.get("bidPr"),
        "ask": row.get("askPr"),
        "change24h": row.get("change24h"),
        "high24h": row.get("high24h"),
        "low24h": row.get("low24h"),
        "volume": row.get("usdtVolume") or row.get("quoteVolume"),
        "source": "v2/spot/market/tickers",
    }


def llm(org: str):
    from crewai import LLM

    key = os.getenv("GROQ_API_KEY_A" if org == "A" else "GROQ_API_KEY_B")
    model = MODEL_A if org == "A" else MODEL_B
    return LLM(
        model=model if "/" in model else f"openai/{model}",
        api_key=key,
        base_url="https://api.groq.com/openai/v1",
        temperature=0.2 if org == "B" else 0.35,
    )


def run_crew(symbol: str, horizon: str, side: str, snapshot: dict | None = None) -> str:
    from crewai import Agent, Crew, Process, Task

    snap = snapshot or scout(symbol)
    symbol = str(snap.get("symbol") or symbol).upper()
    news_notes = collect_signal_brief(symbol)
    snap_json = json.dumps(snap)

    news = Agent(
        role="News clerk (bitget-signal)",
        goal="Summarize only supplied bitget-signal notes; never invent headlines",
        backstory="Rook research clerk. Official perception is bitget-signal MCP.",
        allow_delegation=False,
        llm=llm("A"),
    )
    bull = Agent(
        role="Bull analyst",
        goal="Write the strongest honest long case using the injected Bitget last price",
        backstory="Adversarial bull. Never invent prints.",
        allow_delegation=False,
        llm=llm("A"),
    )
    bear = Agent(
        role="Bear analyst",
        goal="Destroy the bull case with specific risks and invalidation ideas",
        backstory="Adversarial bear for the Rook desk.",
        allow_delegation=False,
        llm=llm("A"),
    )
    judge = Agent(
        role="Judge",
        goal="Emit ONLY the Rook Judge JSON with invalidation and action. Never place an order.",
        backstory="Desk head. Human decides.",
        allow_delegation=False,
        llm=llm("B"),
    )

    t_news = Task(
        description=(
            f"Symbol {symbol}. bitget-signal notes:\n{news_notes}\n"
            "Do not invent sources. If empty, output exactly: no external headlines available"
        ),
        expected_output="Headline / macro notes or the refusal string",
        agent=news,
    )
    t_bull = Task(
        description=f"Write BULL CASE for {symbol} {horizon} side={side}. Snapshot JSON (authoritative): {snap_json}",
        expected_output="Bull case prose",
        agent=bull,
        context=[t_news],
    )
    t_bear = Task(
        description=f"Write BEAR CASE for {symbol}. Attack the bull. Snapshot: {snap_json}",
        expected_output="Bear case prose",
        agent=bear,
        context=[t_bull, t_news],
    )
    t_judge = Task(
        description=(
            f"Judge the debate for {symbol} {horizon} requested side={side}. "
            f"Use snapshot last={snap.get('last')}. Return ONLY JSON matching:\n{JUDGE_SCHEMA}"
        ),
        expected_output="Single JSON object matching the Rook judge schema",
        agent=judge,
        context=[t_news, t_bull, t_bear],
    )

    crew = Crew(
        agents=[news, bull, bear, judge],
        tasks=[t_news, t_bull, t_bear, t_judge],
        process=Process.sequential,
        verbose=False,
    )
    result = crew.kickoff()
    return str(result)


def main() -> None:
    json_mode = "--json" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--json"]
    snapshot = None
    if json_mode and not sys.stdin.isatty():
        raw = sys.stdin.read().strip()
        if raw:
            payload = json.loads(raw)
            symbol = str(payload.get("symbol", "BTCUSDT")).upper()
            horizon = str(payload.get("horizon", "7d"))
            side = str(payload.get("side", "decide"))
            snapshot = payload.get("snapshot")
        else:
            symbol, horizon, side = "BTCUSDT", "7d", "decide"
    else:
        symbol = (args[0] if len(args) > 0 else "BTCUSDT").upper()
        horizon = args[1] if len(args) > 1 else "7d"
        side = args[2] if len(args) > 2 else "decide"

    text = run_crew(symbol, horizon, side, snapshot)
    sys.stdout.write(text if text.endswith("\n") else text + "\n")


if __name__ == "__main__":
    main()
