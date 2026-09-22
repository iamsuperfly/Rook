import type { Horizon, InvalidationBlob, JudgeReport, PaperRunRow, PaperStatus } from "@/lib/types";
import { MAX_OPEN_PAPER, PaperLimitError, isPaperDir } from "@/lib/desk/paper";
import {
  PAPER_MIN_MARGIN,
  PAPER_MMR,
  isPaperLeverage,
  liquidationPrice,
  paperExposure,
} from "@/lib/desk/paper-sim";
import { PaperFundsError, creditAvailable, debitAvailable } from "./paper-wallet";
import { getServiceDb } from "./supabase";
import { ensureUser } from "./watches";

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
  const inv: InvalidationBlob = {
    price: opts.report.invalidation_price,
    note: opts.report.invalidation_note,
    rules: opts.report.i_am_wrong_if,
  };
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
      mmr: PAPER_MMR,
      liq_price: liq,
      thesis: opts.report,
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
  return data as PaperRunRow;
}

export async function addPaperMargin(id: string, chatId: number, amount: number): Promise<PaperRunRow> {
  if (!Number.isFinite(amount) || amount <= 0) throw new PaperFundsError("bad_amount");
  const run = await getPaperRun(id);
  if (!run || run.chat_id !== chatId) throw new PaperFundsError("paper_not_found");
  if (run.status !== "open") throw new PaperFundsError("paper_not_open");
  const current = Number(run.margin_usdt ?? 0);
  if (current <= 0) throw new PaperFundsError("legacy_unlevered");

  await debitAvailable(chatId, amount);
  const nextMargin = current + amount;
  const exposure = Number(run.exposure_usdt ?? paperExposure(current, Number(run.leverage ?? 1)));
  const nextLev = exposure / nextMargin;
  const liq = liquidationPrice({
    side: run.side,
    entry: Number(run.entry_price),
    leverage: nextLev,
  });
  const db = getServiceDb();
  const { data, error } = await db
    .from("paper_runs")
    .update({
      margin_usdt: nextMargin,
      leverage: nextLev,
      liq_price: liq,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "open")
    .select("*")
    .single();
  if (error) {
    await creditAvailable(chatId, amount).catch(() => undefined);
    throw error;
  }
  return data as PaperRunRow;
}

export async function settlePaperClose(opts: {
  id: string;
  chatId: number;
  status: PaperStatus;
  last: number;
  pnlPct: number | null;
  pnlUsdt: number | null;
  closeReason: string | null;
}): Promise<PaperRunRow> {
  const run = await getPaperRun(opts.id);
  if (!run || run.chat_id !== opts.chatId) throw new Error("paper_not_found");
  if (run.status !== "open") return run;

  const margin = Number(run.margin_usdt ?? 0);
  const realized = opts.pnlUsdt ?? 0;
  if (margin > 0) {
    const credit = Math.max(0, margin + realized);
    await creditAvailable(opts.chatId, credit);
  }

  return updatePaperRun(opts.id, {
    status: opts.status,
    last_price: opts.last,
    pnl_pct: opts.pnlPct,
    pnl_usdt: realized,
    close_reason: opts.closeReason,
    closed_at: new Date().toISOString(),
  });
}

export async function listPaperRuns(chatId: number, openOnly = false): Promise<PaperRunRow[]> {
  const db = getServiceDb();
  let q = db.from("paper_runs").select("*").eq("chat_id", chatId).order("opened_at", { ascending: false });
  if (openOnly) q = q.eq("status", "open");
  const { data, error } = await q.limit(20);
  if (error) throw error;
  return (data ?? []) as PaperRunRow[];
}

export async function listOpenPaperRuns(chatId?: number): Promise<PaperRunRow[]> {
  const db = getServiceDb();
  let q = db.from("paper_runs").select("*").eq("status", "open").order("updated_at", { ascending: false });
  if (chatId !== undefined) q = q.eq("chat_id", chatId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PaperRunRow[];
}

export async function listClosedPaperRuns(chatId: number): Promise<PaperRunRow[]> {
  const db = getServiceDb();
  const { data, error } = await db
    .from("paper_runs")
    .select("*")
    .eq("chat_id", chatId)
    .neq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as PaperRunRow[];
}

export async function getPaperRun(id: string): Promise<PaperRunRow | null> {
  const db = getServiceDb();
  const { data, error } = await db.from("paper_runs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as PaperRunRow) ?? null;
}

export async function updatePaperRun(
  id: string,
  patch: Partial<
    Pick<
      PaperRunRow,
      "last_price" | "pnl_pct" | "pnl_usdt" | "status" | "close_reason" | "closed_at" | "margin_usdt" | "leverage" | "liq_price"
    >
  >,
): Promise<PaperRunRow> {
  const db = getServiceDb();
  const { data, error } = await db
    .from("paper_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as PaperRunRow;
}

export type { PaperStatus };
