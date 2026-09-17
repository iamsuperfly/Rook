import { crossedInvalidation } from "@/lib/bitget/scout";
import type { Bias, JudgeReport, PaperRunRow, PaperStatus } from "@/lib/types";

export function paperPnlPct(side: string, entry: number, last: number): number | null {
  if (!Number.isFinite(entry) || !Number.isFinite(last) || entry === 0) return null;
  const raw = ((last - entry) / entry) * 100;
  const dir = side === "short" ? -1 : 1;
  return raw * dir;
}

export function scorePaper(run: PaperRunRow, last: number): {
  pnl_pct: number | null;
  status: PaperStatus;
  close_reason: string | null;
} {
  const thesis = run.thesis;
  const side = run.side === "short" || thesis?.bias === "short" ? "short" : "long";
  const inv = run.invalidation?.price ?? thesis?.invalidation_price ?? null;
  const crossed = crossedInvalidation(side, last, inv);
  const pnl = paperPnlPct(side, Number(run.entry_price), last);
  if (crossed) {
    return { pnl_pct: pnl, status: "invalidated", close_reason: `Invalidation crossed at ${last} vs ${inv}` };
  }
  return { pnl_pct: pnl, status: run.status === "open" ? "open" : run.status, close_reason: run.close_reason };
}

export function paperBias(report: JudgeReport): Bias {
  if (report.bias === "long" || report.bias === "short") return report.bias;
  return "none";
}
