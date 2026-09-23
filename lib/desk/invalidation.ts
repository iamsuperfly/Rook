import { crossedInvalidation } from "@/lib/bitget/scout";
import type { JudgeReport, MarketSnapshot } from "@/lib/types";

/** Minimum adverse gap when the model copies snapshot last as the close line. */
export const FALLBACK_ADVERSE_PCT = 1;

export type InvalidationSnapshot = Pick<MarketSnapshot, "last"> & {
  high24h?: number | null;
  low24h?: number | null;
  sma20?: number | null;
};

export function sideFromBias(bias: string | null | undefined): "long" | "short" | null {
  const s = (bias ?? "").toLowerCase();
  if (s === "long" || s === "short") return s;
  return null;
}

export function isValidInvalidation(side: "long" | "short", last: number, price: number): boolean {
  if (!Number.isFinite(last) || last <= 0 || !Number.isFinite(price) || price <= 0) return false;
  if (side === "long") return price < last;
  return price > last;
}

/**
 * One deterministic close price for display, storage, and check-now.
 * Secondary notes (volume, news) stay in i_am_wrong_if — they do not close the paper call.
 *
 * Preference order when the model price is unusable (null, last, or wrong side of last):
 * 1. 24h extreme on the adverse side (high for short, low for long)
 * 2. SMA20 if it sits on the adverse side of last
 * 3. last ± FALLBACK_ADVERSE_PCT
 */
export function authoritativeInvalidationPrice(opts: {
  side: "long" | "short" | null;
  last: number;
  proposed: number | null | undefined;
  high24h?: number | null;
  low24h?: number | null;
  sma20?: number | null;
}): number | null {
  const last = Number(opts.last);
  if (!Number.isFinite(last) || last <= 0) return null;
  const proposed = opts.proposed == null ? null : Number(opts.proposed);
  if (!opts.side) {
    return proposed != null && Number.isFinite(proposed) && proposed > 0 ? proposed : null;
  }
  if (proposed != null && isValidInvalidation(opts.side, last, proposed)) return proposed;

  const high = opts.high24h != null ? Number(opts.high24h) : null;
  const low = opts.low24h != null ? Number(opts.low24h) : null;
  const sma = opts.sma20 != null ? Number(opts.sma20) : null;
  if (opts.side === "short") {
    if (high != null && isValidInvalidation("short", last, high)) return high;
    if (sma != null && isValidInvalidation("short", last, sma)) return sma;
    return last * (1 + FALLBACK_ADVERSE_PCT / 100);
  }
  if (low != null && isValidInvalidation("long", last, low)) return low;
  if (sma != null && isValidInvalidation("long", last, sma)) return sma;
  return last * (1 - FALLBACK_ADVERSE_PCT / 100);
}

export function deterministicInvalidationNote(side: "long" | "short", price: number, last: number): string {
  if (side === "short") {
    return `Short is invalidated if last trades at or above ${price} (adverse move above the ${last} snapshot).`;
  }
  return `Long is invalidated if last trades at or below ${price} (adverse move below the ${last} snapshot).`;
}

export function applyAuthoritativeInvalidation(
  report: JudgeReport,
  snapshot: InvalidationSnapshot,
  sideOverride?: "long" | "short" | null,
): JudgeReport {
  const side = sideOverride ?? sideFromBias(report.bias);
  const price = authoritativeInvalidationPrice({
    side,
    last: snapshot.last,
    proposed: report.invalidation_price,
    high24h: snapshot.high24h,
    low24h: snapshot.low24h,
    sma20: snapshot.sma20,
  });
  report.invalidation_price = price;
  if (side && price != null) {
    // Note must describe the same line automation uses — never a leftover opposite-side phrase.
    report.invalidation_note = deterministicInvalidationNote(side, price, snapshot.last);
  }
  return report;
}

export function paperInvalidationBlob(report: JudgeReport): { price: number | null; note: string; rules: string[] } {
  return {
    price: report.invalidation_price,
    note: report.invalidation_note,
    rules: report.i_am_wrong_if ?? [],
  };
}

export function sameInvalidationLine(displayed: number | null, stored: number | null): boolean {
  if (displayed == null && stored == null) return true;
  if (displayed == null || stored == null) return false;
  return Math.abs(displayed - stored) < 1e-9;
}

export { crossedInvalidation };
