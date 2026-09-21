# Rook

Adversarial AI trading desk for **Bitget tokenized US names / USDT markets**.

Rook builds a thesis, attacks it, writes a hard invalidation price, watches the market, and can freeze a **paper** call when you press CALL LIVE. It never places a Bitget order.

**[@getrookbot](https://t.me/getrookbot)** — Bitget AI Base Camp Hackathon S2 · track **AI Trading Desk** (Personalized Research Workbench / Decision Stress Testing).

Not financial advice. Paper P&L is a simulation against public last, not live trading performance.

## What it does

1. Scout a Bitget public ticker (last, 24h, realized vol, SMA20). Bare `NVDA` → `NVDAUSDT`, then `RNVDAUSDT` if needed.
2. Pull headline notes from bitget-signal (public MCP). Empty or failed notes become `no external headlines available`. No invented sources.
3. Debate bull vs bear, then Judge writes JSON: bias, confidence, evidence, strategy, invalidation price, action.
4. WATCH THIS stores the thesis. CHECK NOW / the external scheduler re-reads price against the **stored** invalidation first.
5. CALL LIVE is user-triggered. LONG or SHORT bias opens that paper side. NONE asks you to pick before any row is inserted.
6. MY PAPER is the open book (max 10). STOP PAPER or a crossed invalidation price moves the call to RECORDS.

```text
Bitget public snapshot
  → news notes (bitget-signal)
  → Bull / Bear
  → Judge JSON
  → thesis + invalidation price
  → WATCH THIS                    (monitor the thesis)
  → CALL LIVE (you press it)      (directional paper call)
       ├─ bias LONG  → open LONG
       ├─ bias SHORT → open SHORT
       └─ bias NONE  → you pick LONG or SHORT
  → live mark on the same check pass
  → STOPPED or INVALIDATED → RECORDS
```

A watch and a paper call stay separate. Stopping paper does not delete the watch.

## Paper book

CALL LIVE never fires from a generated thesis alone.

| Judge bias | What CALL LIVE does |
| --- | --- |
| LONG | opens `side = long` |
| SHORT | opens `side = short` |
| NONE | prompts LONG / SHORT. No insert until you choose |

New rows never store `side = decide`. Legacy `decide` rows are left alone and are not counted as wins or losses.

P&L uses live public last:

- LONG `(last − entry) / entry × 100`
- SHORT `(entry − last) / entry × 100`

Cap is **10 open calls per chat**, not a lifetime cap. Closed calls free a slot. RECORDS is unlimited.

The automated close uses the **stored invalidation price**. Warning-sign bullets can sit on the card; only the price invalidates the call. An alert shows the same price that was evaluated.

## Scores

`confidence` and `evidence` are integers 0–100 from the Judge.

- **Confidence** — how strongly the Judge supports the directional lean
- **Evidence** — how strong or usable the available evidence is

They are model scores, not probabilities. `confidence 45` is not "45% chance this goes up." Modest confidence can still sit next to bias LONG.

## Telegram

Keyboard:

```
NEW THESIS        MY WATCHES
MY PAPER          RECORDS
CHECK NOW         LAST REPORT
SETTINGS          HELP
```

The reply keyboard is **not** Telegram `is_persistent`. First Android Back hides it. Second Back leaves the chat.

SETTINGS stores 15m / 1h / 4h as a preference only. The check job is still external. That implementation detail is not shown in the settings card.

## Check cycle

One path: `GET /api/check` (header `x-cron-secret`) and Telegram CHECK NOW.

Each pass:

- active watches: stored invalidation vs last
- Judge rewrite only if the line is crossed, CHECK NOW / REFRESH, or a >5% move
- open paper: mark last, P&L, invalidate if the stored price is crossed
- alert when action changes, confidence drops ≥15, or a call is closed

No second poller.

## CrewAI

CrewAI is the intended reasoning engine when `CREW_ENABLED=true` and Python can spawn:

```text
News → Bull → Bear → Judge   (sequential, no delegation)
```

`lib/desk/debate.ts` tries that first. If the spawn is missing (typical Vercel Hobby), the same Judge schema runs on Groq TypeScript with the same signal notes. Production does not import the `crewai` package.

```bash
cd crew
bash setup.sh
source .venv/bin/activate
python crew.py BTCUSDT 7d decide
```

## Setup

Apply `supabase/migrations/` in order (`001`, `002`, `003`). Copy `.env.example` — never commit a real `.env`.

```bash
npm install
npm test
npm run dev
```

Health: `GET /api/health`. Webhook routes use the Node runtime (`maxDuration = 60`).

### Environment

Required: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY_A`, `GROQ_API_KEY_B`, `CRON_SECRET`.

Optional: `GROQ_MODEL_A`, `GROQ_MODEL_B`, `BITGET_BASE`, `BITGET_SIGNAL_MCP`, `CREW_ENABLED`, `CREW_PYTHON`, `CREW_SCRIPT`.

RLS denies `anon` and `authenticated`. Only the service role is used on the server.

### Webhook

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://<vercel>/api/telegram&secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

### Check job

External scheduler every 15 minutes:

- URL: `https://<vercel>/api/check`
- Method: GET
- Header: `x-cron-secret: <CRON_SECRET>`

## Stack

Next.js 15 App Router, TypeScript, Vercel, Supabase Postgres, Groq (org A 20b / org B 120b), Bitget public REST, optional CrewAI + bitget-signal MCP, Vitest.

## License

MIT — Copyright (c) 2026 Rook contributors
