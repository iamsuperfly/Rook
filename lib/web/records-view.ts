import { isPaperDir, leveragedPaper, recordsStats } from "@/lib/desk/paper";
import { displayPnlUsdt } from "@/lib/telegram/paper-format";
import { fmtNum, fmtUtc, invRelationLabel } from "@/lib/telegram/format";
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

export function pnlTone(n: number | null | undefined): "up" | "down" | "flat" {
  if (n == null || !Number.isFinite(n) || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}

export interface PublicRecordCard {
  id: string;
  symbol: string;
  side: string;
  status: string;
  horizon: string;
  pnlPct: string;
  pnlUsdt: string | null;
  pnlTone: "up" | "down" | "flat";
  openedAt: string;
  closedAt: string | null;
  entry: string;
  exit: string | null;
}

export function toPublicCard(run: PaperRunRow): PublicRecordCard {
  const pnl = displayPnlUsdt(run);
  return {
    id: run.id,
    symbol: run.symbol,
    side: sideLabel(run.side),
    status: run.status.toUpperCase(),
    horizon: run.horizon,
    pnlPct: fmtSignedPct(run.pnl_pct),
    pnlUsdt: fmtSignedUsdt(pnl),
    pnlTone: pnlTone(run.pnl_pct ?? pnl),
    openedAt: fmtUtc(run.opened_at),
    closedAt: run.closed_at ? fmtUtc(run.closed_at) : null,
    entry: fmtNum(Number(run.entry_price)),
    exit: run.last_price != null ? fmtNum(Number(run.last_price)) : null,
  };
}

export interface PublicReceiptView {
  symbol: string;
  side: string;
  horizon: string;
  status: string;
  entry: string;
  exit: string;
  pnlPct: string;
  pnlUsdt: string | null;
  pnlTone: "up" | "down" | "flat";
  leverage: string | null;
  margin: string | null;
  exposure: string | null;
  liquidation: string | null;
  invalidation: string;
  invRelation: string | null;
  invNote: string;
  thesis: string;
  warningSigns: string[];
  closeReason: string;
  openedAt: string;
  closedAt: string | null;
  leveraged: boolean;
}

export function toPublicReceipt(run: PaperRunRow): PublicReceiptView {
  const last = Number(run.last_price ?? run.entry_price);
  const inv = run.invalidation?.price ?? run.thesis?.invalidation_price ?? null;
  const note = run.invalidation?.note ?? run.thesis?.invalidation_note ?? "";
  const rules = run.invalidation?.rules ?? run.thesis?.i_am_wrong_if ?? [];
  const thesisLine = run.thesis?.strategy || run.thesis?.reason || "";
  const rawLiq = run.liquidation_price ?? run.liq_price;
  const liq = rawLiq != null && Number.isFinite(Number(rawLiq)) ? Number(rawLiq) : null;
  const pnl = displayPnlUsdt(run);
  const leveraged = leveragedPaper(run);
  return {
    symbol: run.symbol,
    side: sideLabel(run.side),
    horizon: run.horizon,
    status: run.status.toUpperCase(),
    entry: fmtNum(Number(run.entry_price)),
    exit: fmtNum(last),
    pnlPct: fmtSignedPct(run.pnl_pct),
    pnlUsdt: fmtSignedUsdt(pnl),
    pnlTone: pnlTone(run.pnl_pct ?? pnl),
    leverage: leveraged ? `${fmtNum(Number(run.leverage ?? 0), 2)}x` : null,
    margin: leveraged ? fmtSignedUsdt(Number(run.margin_usdt ?? 0)) : null,
    exposure: leveraged ? fmtSignedUsdt(Number(run.exposure_usdt ?? 0)) : null,
    liquidation: liq != null ? fmtNum(liq) : null,
    invalidation: fmtNum(inv),
    invRelation: inv != null && Number.isFinite(last) ? invRelationLabel(last, inv) : null,
    invNote: note,
    thesis: thesisLine,
    warningSigns: rules,
    closeReason: closeWhy(run),
    openedAt: fmtUtc(run.opened_at),
    closedAt: run.closed_at ? fmtUtc(run.closed_at) : null,
    leveraged,
  };
}

export { recordsStats };
