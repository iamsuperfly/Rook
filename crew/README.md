# Rook CrewAI twin (local / writeup only)

This folder is the **design twin** of `lib/desk`. Production on Vercel does **not** import CrewAI.

Roles match the serverless desk:

| Agent | Groq org | Model env |
| --- | --- | --- |
| News | A | `GROQ_API_KEY_A` / `GROQ_MODEL_A` |
| Bull | A | same |
| Bear | A | same |
| Judge | B | `GROQ_API_KEY_B` / `GROQ_MODEL_B` |

```bash
cd crew
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # fill keys
python crew.py BTCUSDT 7d decide
```

`allow_delegation=False`, `process=sequential`.
Judge task demands the same JSON schema as `lib/desk/judge.ts`.
News must not invent headlines.
