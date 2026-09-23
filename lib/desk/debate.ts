import type { DebateBundle, Horizon, JudgeReport, MarketSnapshot, Side } from "@/lib/types";
import { collectSignalBrief } from "@/lib/bitget/signal";
import { scoutSymbol } from "@/lib/bitget/scout";
import { debateViaCrew } from "./crew-bridge";
import { groqComplete } from "./groq";
import { applyAuthoritativeInvalidation } from "./invalidation";
import { parseJudgeReport } from "./judge";
import { BULL_BEAR_SYSTEM, JUDGE_SYSTEM, NEWS_SYSTEM, bullBearUser, judgeUser, newsUser } from "./prompts";

export async function runNewsBrief(symbol: string): Promise<string> {
  const headlines = await collectSignalBrief(symbol);
  if (headlines === "no external headlines available") return headlines;
  try {
    return await groqComplete({
      org: "A",
      system: NEWS_SYSTEM,
      user: newsUser(symbol, headlines),
      temperature: 0.2,
    });
  } catch (err) {
    console.warn("[news] groq failed, passing raw signal notes", err);
    return headlines;
  }
}

export async function runDebate(opts: {
  symbol: string;
  horizon: Horizon;
  side: Side;
  snapshot?: MarketSnapshot;
  prior?: JudgeReport;
  rewrite?: boolean;
}): Promise<DebateBundle> {
  const snapshot = opts.snapshot ?? (await scoutSymbol(opts.symbol));
  const news = await runNewsBrief(snapshot.symbol);

  const viaCrew = await debateViaCrew({
    symbol: snapshot.symbol,
    horizon: opts.horizon,
    side: opts.side,
    snapshot,
    news,
  });
  if (viaCrew) return viaCrew;

  const bullBear = await groqComplete({
    org: "A",
    system: BULL_BEAR_SYSTEM,
    user: bullBearUser({
      symbol: snapshot.symbol,
      horizon: opts.horizon,
      side: opts.side,
      snapshot,
      news,
    }),
  });
  const judgeText = await groqComplete({
    org: "B",
    system: JUDGE_SYSTEM,
    user: judgeUser({
      symbol: snapshot.symbol,
      horizon: opts.horizon,
      side: opts.side,
      snapshot,
      news,
      bullBear,
      prior: opts.prior ? JSON.stringify(opts.prior) : undefined,
    }),
    temperature: 0.15,
  });
  const report = applyAuthoritativeInvalidation(
    parseJudgeReport(judgeText, snapshot.symbol, opts.horizon),
    snapshot,
  );
  report.symbol = snapshot.symbol;
  report.horizon = opts.horizon;
  return { snapshot, news, bullBear, report };
}

export function shouldRewriteJudge(opts: {
  force?: boolean;
  crossed: boolean;
  moveAbsPct: number | null;
}): boolean {
  if (opts.force) return true;
  if (opts.crossed) return true;
  if (opts.moveAbsPct !== null && Math.abs(opts.moveAbsPct) > 5) return true;
  return false;
}
