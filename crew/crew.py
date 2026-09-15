#!/usr/bin/env python3
"""Local CrewAI twin of lib/desk. Not imported by Next.js."""

from __future__ import annotations

import json
import os
import sys
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

try:
    from crewai import Agent, Crew, Process, Task
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Install crew deps: pip install -r crew/requirements.txt") from exc

BITGET = os.getenv("BITGET_BASE", "https://api.bitget.com")
MODEL_A = os.getenv("GROQ_MODEL_A", "openai/gpt-oss-20b")
MODEL_B = os.getenv("GROQ_MODEL_B", "openai/gpt-oss-120b")

JUDGE_SCHEMA = """
{
  "symbol": "NVDAUSDT",
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


def scout(symbol: str) -> dict[str, Any]:
    url = f"{BITGET}/api/v2/spot/market/tickers?symbol={symbol}"
    res = requests.get(url, timeout=10)
    body = res.json()
    if body.get("code") != "00000" or not body.get("data"):
        raise SystemExit(f"ticker not found: {symbol} {body}")
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
    }


def llm(org: str):
    from crewai import LLM

    key = os.getenv("GROQ_API_KEY_A" if org == "A" else "GROQ_API_KEY_B")
    model = MODEL_A if org == "A" else MODEL_B
    return LLM(
        model=f"openai/{model}" if not model.startswith("openai/") else model,
        api_key=key,
        base_url="https://api.groq.com/openai/v1",
    )


def main() -> None:
    symbol = (sys.argv[1] if len(sys.argv) > 1 else "BTCUSDT").upper()
    horizon = sys.argv[2] if len(sys.argv) > 2 else "7d"
    side = sys.argv[3] if len(sys.argv) > 3 else "decide"
    snap = scout(symbol)
    snap_json = json.dumps(snap)

    news = Agent(
        role="News clerk",
        goal="Summarize only real headlines; never invent sources",
        backstory="Research clerk for Rook. If no headlines, say 'no external headlines available'.",
        allow_delegation=False,
        llm=llm("A"),
    )
    bull = Agent(
        role="Bull",
        goal="Write the strongest honest long case using the snapshot last price",
        backstory="Adversarial bull who still refuses to invent prints.",
        allow_delegation=False,
        llm=llm("A"),
    )
    bear = Agent(
        role="Bear",
        goal="Destroy the bull case with specific risks",
        backstory="Adversarial bear for Rook desk.",
        allow_delegation=False,
        llm=llm("A"),
    )
    judge = Agent(
        role="Judge",
        goal="Emit the Rook JSON contract with invalidation and action",
        backstory="Desk head. Never places an order.",
        allow_delegation=False,
        llm=llm("B"),
    )

    t_news = Task(
        description=(
            f"Symbol {symbol}. Do not invent headlines. "
            "If you have no fetched page, output exactly: no external headlines available"
        ),
        expected_output="Headline notes or the refusal string",
        agent=news,
    )
    t_bull = Task(
        description=f"Write BULL CASE for {symbol} {horizon} side={side}. Snapshot: {snap_json}",
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
            f"Judge the debate for {symbol} {horizon}. Use snapshot last={snap.get('last')}. "
            f"Return ONLY JSON matching this schema: {JUDGE_SCHEMA}"
        ),
        expected_output="Single JSON object matching the Rook judge schema",
        agent=judge,
        context=[t_news, t_bull, t_bear],
    )

    crew = Crew(
        agents=[news, bull, bear, judge],
        tasks=[t_news, t_bull, t_bear, t_judge],
        process=Process.sequential,
        verbose=True,
    )
    result = crew.kickoff()
    print("\n=== JUDGE ===\n")
    print(result)


if __name__ == "__main__":
    main()
