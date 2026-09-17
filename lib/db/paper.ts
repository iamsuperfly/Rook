import type { Horizon, InvalidationBlob, JudgeReport, PaperRunRow } from "@/lib/types";
import { getServiceDb } from "./supabase";
import { ensureUser } from "./watches";

export async function openPaperRun(opts: {
  chatId: number;
  watchId?: string | null;
  symbol: string;
  horizon: Horizon;
  side: string;
  entry: number;
  report: JudgeReport;
}): Promise<PaperRunRow> {
  await ensureUser(opts.chatId);
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
      thesis: opts.report,
      invalidation: inv,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PaperRunRow;
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

export async function getPaperRun(id: string): Promise<PaperRunRow | null> {
  const db = getServiceDb();
  const { data, error } = await db.from("paper_runs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as PaperRunRow) ?? null;
}

export async function updatePaperRun(
  id: string,
  patch: Partial<Pick<PaperRunRow, "last_price" | "pnl_pct" | "status" | "close_reason" | "closed_at">>,
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
