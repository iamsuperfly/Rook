import type { Horizon, InvalidationBlob, JudgeReport, PaperRunRow, PaperStatus } from "@/lib/types";
import { MAX_OPEN_PAPER, PaperLimitError, isPaperDir } from "@/lib/desk/paper";
import {
  PAPER_MIN_MARGIN,
  isPaperLeverage,
  liquidationPrice,
  paperExposure,
} from "@/lib/desk/paper-sim";
import { applyAuthoritativeInvalidation, paperInvalidationBlob } from "@/lib/desk/invalidation";
import { PaperFundsError, creditAvailable, debitAvailable } from "./paper-wallet";
import { getServiceDb } from "./supabase";
import { ensureUser } from "./watches";

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map applied-005 `liquidation_price` onto the in-memory alias. */
export function storedLiqPrice(run: Pick<PaperRunRow, "liquidation_price" | "liq_price">): number | null {
  return numOrNull(run.liquidation_price ?? run.liq_price);
}

export function asPaperRun(row: Record<string, unknown>): PaperRunRow {
  const liq = numOrNull(row.liquidation_price ?? row.liq_price);
  return {
    ...(row as unknown as PaperRunRow),
    liquidation_price: liq,
    liq_price: liq,
  };
}

export async function countOpenPaperRuns(chatId: number): Promise<number> {
  const db = getServiceDb();
  const { count, error } = await db
    .from("paper_runs")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .eq("status", "open");
  if (error) throw error;
  return count ?? 0;
}

export async function openPaperRun(opts: {
  chatId: number;
  watchId?: string | null;
  symbol: string;
  horizon: Horizon;
  side: string;
  entry: number;
  report: JudgeReport;
  marginUsdt: number;
  leverage: number;
}): Promise<PaperRunRow> {
  if (!isPaperDir(opts.side)) {
    throw new Error("paper_side_required");
  }
  if (!Number.isFinite(opts.marginUsdt) || opts.marginUsdt < PAPER_MIN_MARGIN) {
    throw new PaperFundsError("margin_too_small");
  }
  if (!isPaperLeverage(opts.leverage)) {
    throw new PaperFundsError("bad_leverage");
  }
  await ensureUser(opts.chatId);
  const openCount = await countOpenPaperRuns(opts.chatId);
  if (openCount >= MAX_OPEN_PAPER) throw new PaperLimitError();

  await debitAvailable(opts.chatId, opts.marginUsdt);

  const exposure = paperExposure(opts.marginUsdt, opts.leverage);
  const liq = liquidationPrice({
    side: opts.side,
    entry: opts.entry,
    leverage: opts.leverage,
  });
  const db = getServiceDb();
  const report = applyAuthoritativeInvalidation(opts.report, { last: opts.entry }, opts.side as "long" | "short");
  const inv: InvalidationBlob = paperInvalidationBlob(report);
  const { data, error } = await db
    .from("paper_runs")
    .insert({
      chat_id: opts.chatId,
      watch_id: opts.watchId ?? null,
      symbol: opts.symbol,
      horizon: opts.horizon,
      side: opts.side,
      status: "open",
      entry_price: opts.entry,
      last_price: opts.entry,
      pnl_pct: 0,
      pnl_usdt: 0,
      margin_usdt: opts.marginUsdt,
      leverage: opts.leverage,
      exposure_usdt: exposure,
      liquidation_price: liq,
      thesis: report,
      invalidation: inv,
    })
    .select("*")
    .single();
  if (error) {
    await creditAvailable(opts.chatId, opts.marginUsdt).catch(() => undefined);
    const msg = error.message ?? "";
    if (msg.includes("paper_open_limit")) throw new PaperLimitError();
    throw error;
  }
  return asPaperRun(data as Record<string, unknown>);
}
