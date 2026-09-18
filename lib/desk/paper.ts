import { crossedInvalidation } from "@/lib/bitget/scout";
import type { Bias, JudgeReport, PaperRunRow, PaperStatus } from "@/lib/types";

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

export function scorePaper(
  run: PaperRunRow,
  last: number,
): {
  pnl_pct: number | null;
  status: PaperStatus;
  close_reason: string | null;
} {
  const side = isPaperDir(run.side) ? run.side : null;
  const inv = run.invalidation?.price ?? run.thesis?.invalidation_price ?? null;
  const pnl = side ? paperPnlPct(side, Number(run.entry_price), last) : null;
  const crossed = side ? crossedInvalidation(side, last, inv) : false;
  if (crossed) {
    return {
      pnl_pct: pnl,
      status: "invalidated",
      close_reason: `Invalidation crossed at ${last} vs ${inv}`,
    };
  }
  return {
    pnl_pct: pnl,
    status: run.status === "open" ? "open" : run.status,
    close_reason: run.close_reason,
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

export function recordsStats(rows: PaperRunRow[]): { closed: number; wins: number; losses: number } {
  const closed = rows.filter((r) => r.status !== "open");
  const scored = closed.filter(isWinLossEligible);
  return {
    closed: closed.length,
    wins: scored.filter((r) => Number(r.pnl_pct) > 0).length,
    losses: scored.filter((r) => Number(r.pnl_pct) < 0).length,
  };
}

export class PaperLimitError extends Error {
  constructor() {
    super("paper_open_limit");
    this.name = "PaperLimitError";
  }
}
