import type { MarketSnapshot } from "@/lib/types";
import { fetchCandles, fetchTicker } from "./client";

const RTOKEN_PREFIX = "R";

export function normalizeSymbol(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";
  if (cleaned.endsWith("USDT")) return cleaned;
  return `${cleaned}USDT`;
}

export function symbolCandidates(raw: string): string[] {
  const base = normalizeSymbol(raw);
  if (!base) return [];
  const out = [base];
  if (!base.startsWith(RTOKEN_PREFIX) && base.endsWith("USDT")) {
    const bare = base.slice(0, -4);
    out.push(`${RTOKEN_PREFIX}${bare}USDT`);
  }
  return [...new Set(out)];
}

export function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  const window = values.slice(-period);
  const sum = window.reduce((a, b) => a + b, 0);
  return sum / period;
}

export function realizedVolPct(closes: number[], periodsPerYearUnit = 24): number | null {
  if (closes.length < 3) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (prev <= 0 || cur <= 0) continue;
    rets.push(Math.log(cur / prev));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varSum = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const stdev = Math.sqrt(varSum);
  return stdev * Math.sqrt(periodsPerYearUnit) * 100;
}

export function distancePct(last: number, invalidationPrice: number | null | undefined): number | null {
  if (!invalidationPrice || !Number.isFinite(invalidationPrice) || last === 0) return null;
  return ((last - invalidationPrice) / last) * 100;
}

export function crossedInvalidation(
  side: string,
  last: number,
  invalidationPrice: number | null | undefined,
): boolean {
  if (!invalidationPrice || !Number.isFinite(invalidationPrice) || !Number.isFinite(last)) return false;
  const s = side.toLowerCase();
  if (s === "long") return last <= invalidationPrice;
  if (s === "short") return last >= invalidationPrice;
  return false;
}

export function moveVsSnapshotPct(last: number, snapshotLast: number | null | undefined): number | null {
  if (!snapshotLast || snapshotLast === 0) return null;
  return ((last - snapshotLast) / snapshotLast) * 100;
}

export async function scoutSymbol(rawSymbol: string): Promise<MarketSnapshot> {
  const candidates = symbolCandidates(rawSymbol);
  let lastErr: unknown;
  for (const symbol of candidates) {
    try {
      const { ticker, source } = await fetchTicker(symbol);
      const last = parseNum(ticker.lastPr);
      if (last === null) throw new Error("missing_last");
      let candles: Awaited<ReturnType<typeof fetchCandles>> = { candles: [], source: "none" };
      try {
        candles = await fetchCandles(symbol, "1h", 48);
      } catch (err) {
        console.warn("[scout] candles failed", symbol, err);
      }
      const closes = candles.candles.map((c) => c.close);
      const changeRaw = parseNum(ticker.change24h);
      const changeUtc = parseNum(ticker.changeUtc24h);
      const change24hPct = changeUtc !== null ? changeUtc * 100 : changeRaw !== null ? changeRaw * 100 : 0;
      return {
        symbol: ticker.symbol || symbol,
        last,
        bid: parseNum(ticker.bidPr),
        ask: parseNum(ticker.askPr),
        change24hPct,
        high24h: parseNum(ticker.high24h),
        low24h: parseNum(ticker.low24h),
        volumeBase: parseNum(ticker.baseVolume),
        volumeQuote: parseNum(ticker.usdtVolume ?? ticker.quoteVolume),
        realizedVol24hPct: realizedVolPct(closes, 24),
        sma20: sma(closes, 20),
        source,
        asOf: new Date().toISOString(),
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`ticker_not_found:${rawSymbol}`);
}

export async function healthCheckBtc(): Promise<boolean> {
  try {
    const snap = await scoutSymbol("BTCUSDT");
    return Number.isFinite(snap.last);
  } catch {
    return false;
  }
}
