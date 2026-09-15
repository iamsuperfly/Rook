import type { Horizon, MarketSnapshot, Side } from "@/lib/types";

export const NEWS_SYSTEM = `You are Rook News, a research clerk for an adversarial trading desk.
You only summarize supplied headlines or explicitly say none exist.
Never invent sources, tickers, dates, or quotes.
If the notes say "no external headlines available", repeat that phrase and add at most two generic macro watch-items with no fake citations.`;

export const BULL_BEAR_SYSTEM = `You are Rook Debate: one completion, two headings.
Write two sections exactly titled:
## BULL CASE
## BEAR CASE
Use the injected Bitget snapshot numbers. Do not invent a last price.
Be specific, adversarial, and concise (120-180 words each).
No order instructions. Not financial advice.`;

export const JUDGE_SYSTEM = `You are Rook Judge, the adversarial desk head.
Your job is to stress-test the thesis and tell the human when to walk away.
You NEVER place or recommend an executable order size.
Always return a single JSON object matching the schema. No markdown outside the JSON.
confidence and evidence_quality are integers 0-100.
action must be one of: watch | reject | call_off | hold.
invalidation_price must be a number or null, derived from the snapshot last price (never invent last).
If evidence is thin, lower evidence_quality and lean reject or hold.`;

export function newsUser(symbol: string, headlines: string): string {
  return `Symbol: ${symbol}\nHeadline notes:\n${headlines}`;
}

export function bullBearUser(opts: {
  symbol: string;
  horizon: Horizon;
  side: Side;
  snapshot: MarketSnapshot;
  news: string;
}): string {
  return [
    `Symbol: ${opts.symbol}`,
    `Horizon: ${opts.horizon}`,
    `Requested side: ${opts.side}`,
    `Bitget snapshot JSON (authoritative prices):`,
    JSON.stringify(opts.snapshot),
    `News notes: ${opts.news}`,
    `Write the BULL CASE and BEAR CASE. Attack weak points.`,
  ].join("\n");
}

export function judgeUser(opts: {
  symbol: string;
  horizon: Horizon;
  side: Side;
  snapshot: MarketSnapshot;
  news: string;
  bullBear: string;
  prior?: string;
}): string {
  return [
    `Symbol: ${opts.symbol}`,
    `Horizon: ${opts.horizon}`,
    `Requested side: ${opts.side}`,
    `Bitget snapshot JSON (authoritative prices):`,
    JSON.stringify(opts.snapshot),
    `News notes: ${opts.news}`,
    `Debate:`,
    opts.bullBear,
    opts.prior ? `Prior thesis:\n${opts.prior}` : "",
    `Return ONLY this JSON:`,
    `{
  "symbol": "${opts.symbol}",
  "horizon": "${opts.horizon}",
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
}`,
  ]
    .filter(Boolean)
    .join("\n");
}
