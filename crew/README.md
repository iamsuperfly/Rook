# Rook CrewAI engine + bitget-signal

This is the **reasoning engine**, not a toy sidecar.

Official stack:

- CrewAI OSS (`Agent` / `Task` / `Crew` / `Process.sequential`)
- Groq via CrewAI `LLM` + `https://api.groq.com/openai/v1`
- Perception: official `@bitget-ai/bitget-signal` public MCP `https://datahub.noxiaohao.com/mcp` (from the signal installer; no API key)

```
Scout (Bitget REST, code)
    → News agent (bitget-signal MCP notes)
    → Bull (Groq A)
    → Bear (Groq A)
    → Judge JSON (Groq B)
```

## Setup (no CrewAI account)

```bash
bash crew/setup.sh
# add GROQ keys to ../.env
source crew/.venv/bin/activate
python crew/crew.py BTCUSDT 7d decide
```

JSON mode (what Next.js spawns):

```bash
echo '{"symbol":"BTCUSDT","horizon":"7d","side":"decide"}' | python crew/crew.py --json
```

## Production

`lib/desk/debate.ts` tries `crew-bridge` first (`CREW_ENABLED=true`).
If Python/Crew is missing on Vercel Hobby, it falls back to the TypeScript Groq path with the **same Judge schema and the same signal notes**.

Cron still wakes `/api/check`. Crew does not schedule itself.

## Agent Hub

- Used: **bitget-signal** perception MCP (sentiment / news / market tools).
- Not used: `bgc` live orders, agent-mcp trading, API keys.
