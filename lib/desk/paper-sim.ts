/**
 * Paper USDT simulation — isolated-style risk, not Bitget production UTA.
 *
 * Bitget UTA / futures references we borrow language from (not the engine):
 * - Isolated liquidation when isolated equity < maintenance margin (MMR ≈ 100%).
 * - Educational isolated LP (Agent Hub / Bitget AI lessons):
 *     Long  LP ≈ entry × (1 − 1/leverage + MMR)
 *     Short LP ≈ entry × (1 + 1/leverage − MMR)
 * - Production UTA is account-level cross margin with tiered MMR, mark price,
 *   fees, and partial liquidation. Rook does not model those.
 *
 * Every position here is isolated paper: one margin bucket, one LP.
 * Adding margin is always a human action.
 */

export const PAPER_INITIAL_USDT = 10_000;
export const PAPER_DAILY_USDT = 1_000;
export const PAPER_MIN_MARGIN = 10;
export const PAPER_LEVERAGE_OPTIONS = [1, 2, 3, 5, 10] as const;
export type PaperLeverage = (typeof PAPER_LEVERAGE_OPTIONS)[number];

/** First-tier educational MMR used by Bitget Agent Hub lessons (0.5%). */
export const PAPER_MMR = 0.005;

export function isPaperLeverage(n: number): n is PaperLeverage {
  return (PAPER_LEVERAGE_OPTIONS as readonly number[]).includes(n);
}

export function paperExposure(marginUsdt: number, leverage: number): number {
  if (!Number.isFinite(marginUsdt) || !Number.isFinite(leverage)) return 0;
  return Math.max(0, marginUsdt) * Math.max(1, leverage);
}

export function paperPnlUsdt(opts: {
  side: string;
  entry: number;
  last: number;
  exposure: number;
}): number | null {
  if (!Number.isFinite(opts.entry) || !Number.isFinite(opts.last) || opts.entry === 0) return null;
  if (!Number.isFinite(opts.exposure)) return null;
  const move = (opts.last - opts.entry) / opts.entry;
  if (opts.side === "long") return opts.exposure * move;
  if (opts.side === "short") return opts.exposure * -move;
  return null;
}

export function returnOnMarginPct(pnlUsdt: number | null, marginUsdt: number): number | null {
  if (pnlUsdt === null || !Number.isFinite(marginUsdt) || marginUsdt === 0) return null;
  return (pnlUsdt / marginUsdt) * 100;
}

export function maintenanceMargin(exposure: number, mmr = PAPER_MMR): number {
  return Math.max(0, exposure) * mmr;
}

export function liquidationPrice(opts: {
  side: string;
  entry: number;
  leverage: number;
  mmr?: number;
}): number | null {
  const mmr = opts.mmr ?? PAPER_MMR;
  const { side, entry, leverage } = opts;
  if (!Number.isFinite(entry) || entry <= 0) return null;
  if (!Number.isFinite(leverage) || leverage < 1) return null;
  if (side === "long") {
    const f = 1 - 1 / leverage + mmr;
    return f > 0 ? entry * f : 0;
  }
  if (side === "short") {
    return entry * (1 + 1 / leverage - mmr);
  }
  return null;
}

export function distanceToLiquidationPct(opts: {
  side: string;
  last: number;
  liq: number | null;
}): number | null {
  if (opts.liq === null || !Number.isFinite(opts.liq) || !Number.isFinite(opts.last) || opts.last === 0) {
    return null;
  }
  if (opts.side === "long") return ((opts.last - opts.liq) / opts.last) * 100;
  if (opts.side === "short") return ((opts.liq - opts.last) / opts.last) * 100;
  return null;
}

export function crossedLiquidation(opts: {
  side: string;
  last: number;
  liq: number | null;
}): boolean {
  if (opts.liq === null || !Number.isFinite(opts.liq) || !Number.isFinite(opts.last)) return false;
  if (opts.side === "long") return opts.last <= opts.liq;
  if (opts.side === "short") return opts.last >= opts.liq;
  return false;
}

export function isolatedEquity(marginUsdt: number, pnlUsdt: number | null): number {
  return marginUsdt + (pnlUsdt ?? 0);
}

export function isLiquidatedByEquity(opts: {
  marginUsdt: number;
  pnlUsdt: number | null;
  exposure: number;
  mmr?: number;
}): boolean {
  const eq = isolatedEquity(opts.marginUsdt, opts.pnlUsdt);
  return eq <= maintenanceMargin(opts.exposure, opts.mmr ?? PAPER_MMR);
}

export type PaperRiskState = "ok" | "watch" | "danger" | "liquidated";

export function paperRiskState(distancePct: number | null, liquidated: boolean): PaperRiskState {
  if (liquidated) return "liquidated";
  if (distancePct === null) return "ok";
  if (distancePct <= 0) return "liquidated";
  if (distancePct < 3) return "danger";
  if (distancePct < 8) return "watch";
  return "ok";
}

export function realizedClosePnl(opts: {
  liquidated: boolean;
  marginUsdt: number;
  pnlUsdt: number | null;
}): number {
  if (opts.liquidated) {
    const eq = isolatedEquity(opts.marginUsdt, opts.pnlUsdt);
    return eq <= 0 ? -opts.marginUsdt : eq - opts.marginUsdt;
  }
  return opts.pnlUsdt ?? 0;
}

export type StressMove = 1 | 2 | 5;

export interface StressRow {
  adversePct: number;
  last: number;
  pnlUsdt: number | null;
  returnOnMarginPct: number | null;
  liq: number | null;
  distancePct: number | null;
  wouldLiquidate: boolean;
}

export function adverseLast(side: string, last: number, adversePct: number): number {
  const f = adversePct / 100;
  if (side === "long") return last * (1 - f);
  if (side === "short") return last * (1 + f);
  return last;
}

export function leverageAfterAddMargin(exposure: number, newMargin: number): number {
  if (!Number.isFinite(newMargin) || newMargin <= 0) return 1;
  return Math.max(1, exposure / newMargin);
}

export function liquidationAfterAddMargin(opts: {
  side: string;
  entry: number;
  exposure: number;
  newMargin: number;
  mmr?: number;
}): number | null {
  const lev = leverageAfterAddMargin(opts.exposure, opts.newMargin);
  return liquidationPrice({ side: opts.side, entry: opts.entry, leverage: lev, mmr: opts.mmr });
}

export function stressPosition(opts: {
  side: string;
  entry: number;
  last: number;
  marginUsdt: number;
  leverage: number;
  extraMargin?: number;
  moves?: StressMove[];
}): { baselineLiq: number | null; rows: StressRow[]; withExtraLiq: number | null } {
  const exposure = paperExposure(opts.marginUsdt, opts.leverage);
  const liq = liquidationPrice({ side: opts.side, entry: opts.entry, leverage: opts.leverage });
  const moves = opts.moves ?? ([1, 2, 5] as StressMove[]);
  const rows = moves.map((m) => {
    const next = adverseLast(opts.side, opts.last, m);
    const pnl = paperPnlUsdt({ side: opts.side, entry: opts.entry, last: next, exposure });
    const dist = distanceToLiquidationPct({ side: opts.side, last: next, liq });
    const would =
      crossedLiquidation({ side: opts.side, last: next, liq }) ||
      isLiquidatedByEquity({ marginUsdt: opts.marginUsdt, pnlUsdt: pnl, exposure });
    return {
      adversePct: m,
      last: next,
      pnlUsdt: pnl,
      returnOnMarginPct: returnOnMarginPct(pnl, opts.marginUsdt),
      liq,
      distancePct: dist,
      wouldLiquidate: would,
    };
  });
  const extra = opts.extraMargin ?? 0;
  return {
    baselineLiq: liq,
    withExtraLiq:
      extra > 0
        ? liquidationAfterAddMargin({
            side: opts.side,
            entry: opts.entry,
            exposure,
            newMargin: opts.marginUsdt + extra,
          })
        : null,
    rows,
  };
}

export function utcDayKey(iso: string | Date = new Date()): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toISOString().slice(0, 10);
}

export function nextUtcMidnight(from: Date = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1, 0, 0, 0));
}

export function dailyClaimAvailable(lastClaimAt: string | null, now: Date = new Date()): boolean {
  if (!lastClaimAt) return true;
  return utcDayKey(lastClaimAt) !== utcDayKey(now);
}

export function nextDailyClaimAt(lastClaimAt: string | null, now: Date = new Date()): Date {
  if (!lastClaimAt || dailyClaimAvailable(lastClaimAt, now)) return now;
  return nextUtcMidnight(now);
}
