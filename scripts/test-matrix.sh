#!/usr/bin/env bash
# Manual + HTTP test helpers after Vercel is live.
# Usage: BASE=https://YOUR.vercel.app CRON_SECRET=... ./scripts/test-matrix.sh
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
echo "GET $BASE/api/health"
curl -sS "$BASE/api/health" | head -c 500
echo
if [[ -n "${CRON_SECRET:-}" ]]; then
  echo "GET $BASE/api/check"
  curl -sS -H "x-cron-secret: $CRON_SECRET" "$BASE/api/check" | head -c 800
  echo
fi
echo "Telegram matrix (do in @getrookbot):"
echo "  /start"
echo "  NEW THESIS → 7d → YOU DECIDE → BTC"
echo "  WATCH THIS"
echo "  CHECK NOW"
echo "  CALL OFF"
