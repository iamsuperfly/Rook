import { crossedInvalidation } from "@/lib/bitget/scout";
import type { Bias, JudgeReport, PaperRunRow, PaperStatus } from "@/lib/types";
import {
  crossedLiquidation,
  isLiquidatedByEquity,
  liquidationPrice,
  paperExposure,
  paperPnlUsdt,
  realizedClosePnl,
} from "./paper-sim";

export const MAX_OPEN_PAPER = 10;

export type PaperDir = "long" | "short";

export function isPaperDir(side: string | null | undefined): side is PaperDir {
  const s = (side ?? "").toLowerCase();
  return s === "long" || s === "short";
}

export function paperPnlPct(side: string, entry: number, last: number): number | null {
  if (!Number.isFinite(entry) || !Number.isFinite(last) || entry === 0) return null;
  if (side === "long") return ((last - entry) / entry) * 100;
  if (side === "short") return ((entry - last) / entry) * 100;
  return null;
}

export function resolveCallLiveSide(reportBias: string, hintedSide?: string | null): PaperDir | null {
  const hint = (hintedSide ?? "").toLowerCase();
  if (hint === "long" || hint === "short") return hint;
  const bias = (reportBias ?? "").toLowerCase();
  if (bias === "long" || bias === "short") return bias;
  return null;
}

export function storedLiqPrice(run: Pick<PaperRunRow, "liquidation_price" | "liq_price">): number | null {
  const raw = run.liquidation_price ?? run.liq_price;
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function leveragedPaper(run: Pick<PaperRunRow, "margin_usdt" | "leverage">): boolean {
  return Number(run.margin_usdt ?? 0) > 0 && Number(run.leverage ?? 0) >= 1;
}

export function scorePaper(
  run: PaperRunRow,
  last: number,
): {
  pnl_pct: number | null;
  pnl_usdt: number | null;
  status: PaperStatus;
  close_reason: string | null;
  liq_price: number | null;
} {
  const side = isPaperDir(run.side) ? run.side : null;
  const inv = run.invalidation?.price ?? run.thesis?.invalidation_price ?? null;
  const pnlPct = side ? paperPnlPct(side, Number(run.entry_price), last) : null;
  const margin = Number(run.margin_usdt ?? 0);
  const lev = Number(run.leverage ?? 0);
  const exposure = Number(run.exposure_usdt ?? paperExposure(margin, lev));
  const stored = storedLiqPrice(run);
  const liq =
    stored != null
      ? stored
      : side && leveragedPaper(run)
        ? liquidationPrice({ side, entry: Number(run.entry_price), leverage: lev })
        : null;
  const pnlUsdt = side && leveragedPaper(run)
    ? paperPnlUsdt({ side, entry: Number(run.entry_price), last, exposure })
    : null;

  if (side && leveragedPaper(run)) {
    const byPrice = crossedLiquidation({ side, last, liq });
    const byEquity = isLiquidatedByEquity({ marginUsdt: margin, pnlUsdt, exposure });
    if (byPrice || byEquity) {
      const realized = realizedClosePnl({ liquidated: true, marginUsdt: margin, pnlUsdt });
      return {
        pnl_pct: pnlPct,
        pnl_usdt: realized,
        status: "liquidated",
        close_reason: `Simulated liquidation at ${last} (LP ${liq})`,
        liq_price: liq,
      };
    }
  }

  const crossed = side ? crossedInvalidation(side, last, inv) : false;
  if (crossed) {
    return {
      pnl_pct: pnlPct,
      pnl_usdt: pnlUsdt,
      status: "invalidated",
      close_reason: `Invalidation crossed at ${last} vs ${inv}`,
      liq_price: liq,
    };
  }
  return {
    pnl_pct: pnlPct,
    pnl_usdt: pnlUsdt,
    status: run.status === "open" ? "open" : run.status,
    close_reason: run.close_reason,
    liq_price: liq,
  };
}

export function paperBias(report: JudgeReport): Bias {
  if (report.bias === "long" || report.bias === "short") return report.bias;
  return "none";
}

export function isWinLossEligible(run: Pick<PaperRunRow, "side" | "status" | "pnl_pct">): boolean {
  if (run.status === "open") return false;
  if (!isPaperDir(run.side)) return false;
  return typeof run.pnl_pct === "number" && Number.isFinite(Number(run.pnl_pct));
}

export function recordsStats(rows: PaperRunRow[]): {
  closed: number;
  wins: number;
  losses: number;
  liquidated: number;
  avgWinner: number | null;
  avgLoser: number | null;
} {
  const closed = rows.filter((r) => r.status !== "open");
  const scored = closed.filter(isWinLossEligible);
  const wins = scored.filter((r) => Number(r.pnl_pct) > 0);
  const losses = scored.filter((r) => Number(r.pnl_pct) < 0);
  const avg = (list: typeof scored) =>
    list.length ? list.reduce((s, r) => s + Number(r.pnl_pct), 0) / list.length : null;
  return {
    closed: closed.length,
    wins: wins.length,
    losses: losses.length,
    liquidated: closed.filter((r) => r.status === "liquidated").length,
    avgWinner: avg(wins),
    avgLoser: avg(losses),
  };
}

export function canOpenAnotherPaper(openCount: number): boolean {
  return openCount >= 0 && openCount < MAX_OPEN_PAPER;
}

export class PaperLimitError extends Error {
  constructor() {
    super("paper_open_limit");
    this.name = "PaperLimitError";
  }
}
