#!/usr/bin/env bash
# Official OSS CrewAI local setup for Rook. No CrewAI account.
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -U pip
pip install -r requirements.txt
echo
echo "Crew venv ready: crew/.venv"
echo "Put GROQ_API_KEY_A / GROQ_API_KEY_B in repo-root .env then:"
echo "  source crew/.venv/bin/activate && python crew/crew.py BTCUSDT 7d decide"
echo
echo "Telegram falls back to Groq TS if spawn fails."
