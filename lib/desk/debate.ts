import type { DebateBundle, Horizon, JudgeReport, MarketSnapshot, Side } from "@/lib/types";
import { scoutSymbol } from "@/lib/bitget/scout";
import { groqComplete } from "./groq";
import { parseJudgeReport } from "./judge";
import { BULL_BEAR_SYSTEM, JUDGE_SYSTEM, NEWS_SYSTEM, bullBearUser, judgeUser, newsUser } from "./prompts";

async function fetchHeadlineNotes(symbol: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const url = "https://min-api.cryptocompare.com/data/v2/news/?lang=EN";
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) return "no external headlines available";
    const json = (await res.json()) as { Data?: Array<{ title?: string; source?: string; categories?: string }> };
    const needle = symbol.replace(/USDT$/, "").replace(/^R/, "");
    const rows = (json.Data ?? [])
      .filter((n) => {
        const hay = `${n.title ?? ""} ${n.categories ?? ""}`.toUpperCase();
        return hay.includes(needle) || hay.includes("MACRO") || hay.includes("FED") || hay.includes("EQUITY");
      })
      .slice(0, 5);
    if (!rows.length) return "no external headlines available";
    return rows.map((n) => `- ${n.title ?? "untitled"} (${n.source ?? "unspecified"})`).join("\n");
  } catch {
    return "no external headlines available";
  } finally {
    clearTimeout(timer);
  }
}

export async function runNewsBrief(symbol: string): Promise<string> {
  const headlines = await fetchHeadlineNotes(symbol);
  if (headlines === "no external headlines available") return headlines;
  try {
    return await groqComplete({
      org: "A",
      system: NEWS_SYSTEM,
      user: newsUser(symbol, headlines),
      temperature: 0.2,
    });
  } catch (err) {
    console.warn("[news] groq failed, passing raw notes", err);
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
  const report = parseJudgeReport(judgeText, snapshot.symbol, opts.horizon);
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
