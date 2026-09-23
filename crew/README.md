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

JSON mode (what Next.js can spawn locally):

```bash
echo '{"symbol":"BTCUSDT","horizon":"7d","side":"decide"}' | python crew/crew.py --json
```

## Remote worker (Replit Deployment)

Vercel Hobby cannot spawn Python. Point the desk at a live worker instead:

```bash
export CREW_HTTP_SECRET=pick-a-long-random-string
python crew/http_server.py
```

- `GET /health` — liveness
- `POST /debate` — same JSON body as stdin `--json` (`symbol`, `horizon`, `side`, `snapshot`)
- Requires `Authorization: Bearer $CREW_HTTP_SECRET`

On Vercel set:

```
CREW_ENABLED=true
CREW_HTTP_URL=https://YOUR-REPLIT-DEPLOYMENT
CREW_HTTP_SECRET=same-string-as-the-worker
```

`lib/desk/debate.ts` still tries Crew first. If the HTTP worker is down, it falls back to the TypeScript Groq path.

Cron still wakes `/api/check`. Crew does not schedule itself.

## Agent Hub

- Used: **bitget-signal** perception MCP (sentiment / news / market tools).
- Not used: `bgc` live orders, agent-mcp trading, API keys.
