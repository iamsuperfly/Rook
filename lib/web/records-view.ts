import { isPaperDir } from "@/lib/desk/paper";
import { displayPnlUsdt } from "@/lib/telegram/paper-format";
import { fmtUtc } from "@/lib/telegram/format";
import type { PaperRunRow } from "@/lib/types";

export function sideLabel(side: string): string {
  return isPaperDir(side) ? side.toUpperCase() : "NO SIDE";
}

export function fmtSignedUsdt(n: number | null | undefined): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const sign = n < 0 ? "\u2212" : n > 0 ? "+" : "";
  const abs = Math.abs(n);
  const body =
    abs >= 1000
      ? abs.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : abs.toFixed(2).replace(/\.?0+$/, "") || "0";
  return `${sign}${body} USDT`;
}

export function fmtSignedPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  const sign = n > 0 ? "+" : n < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

export function closeWhy(run: PaperRunRow): string {
  if (run.close_reason) return run.close_reason;
  if (run.status === "invalidated") return "Price crossed the stored thesis invalidation.";
  if (run.status === "liquidated") return "Isolated paper equity hit the simulated liquidation line.";
  if (run.status === "stopped") return "Human stopped the paper call.";
  return "Still open.";
}

export interface PublicRecordCard {
  id: string;
  symbol: string;
  side: string;
  status: string;
  horizon: string;
  pnlPct: string;
  pnlUsdt: string | null;
  openedAt: string;
  closedAt: string | null;
  entry: number;
  exit: number | null;
}

export function toPublicCard(run: PaperRunRow): PublicRecordCard {
  return {
    id: run.id,
    symbol: run.symbol,
    side: sideLabel(run.side),
    status: run.status.toUpperCase(),
    horizon: run.horizon,
    pnlPct: fmtSignedPct(run.pnl_pct),
    pnlUsdt: fmtSignedUsdt(displayPnlUsdt(run)),
    openedAt: fmtUtc(run.opened_at),
    closedAt: run.closed_at ? fmtUtc(run.closed_at) : null,
    entry: Number(run.entry_price),
    exit: run.last_price != null ? Number(run.last_price) : null,
  };
}
