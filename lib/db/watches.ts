import type { CheckEvery, Horizon, InvalidationBlob, JudgeReport, UserRow, WatchRow } from "@/lib/types";
import { getServiceDb } from "./supabase";

export async function ensureUser(chatId: number): Promise<UserRow> {
  const db = getServiceDb();
  const { data: existing, error: readErr } = await db.from("users").select("*").eq("chat_id", chatId).maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing as UserRow;
  const { data, error } = await db.from("users").insert({ chat_id: chatId }).select("*").single();
  if (error) throw error;
  return data as UserRow;
}

export async function getUser(chatId: number): Promise<UserRow | null> {
  const db = getServiceDb();
  const { data, error } = await db.from("users").select("*").eq("chat_id", chatId).maybeSingle();
  if (error) throw error;
  return (data as UserRow) ?? null;
}

export async function updateUser(
  chatId: number,
  patch: Partial<Pick<UserRow, "alerts_on" | "check_every">>,
): Promise<UserRow> {
  await ensureUser(chatId);
  const db = getServiceDb();
  const { data, error } = await db.from("users").update(patch).eq("chat_id", chatId).select("*").single();
  if (error) throw error;
  return data as UserRow;
}

export async function upsertWatch(opts: {
  chatId: number;
  symbol: string;
  horizon: Horizon;
  side: string;
  report: JudgeReport;
  lastPrice: number;
}): Promise<WatchRow> {
  await ensureUser(opts.chatId);
  const db = getServiceDb();
  const inv: InvalidationBlob = {
    price: opts.report.invalidation_price,
    note: opts.report.invalidation_note,
    rules: opts.report.i_am_wrong_if,
  };
  const { data: current, error: findErr } = await db
    .from("watches")
    .select("*")
    .eq("chat_id", opts.chatId)
    .eq("symbol", opts.symbol)
    .eq("horizon", opts.horizon)
    .eq("active", true)
    .maybeSingle();
  if (findErr) throw findErr;

  const payload = {
    chat_id: opts.chatId,
    symbol: opts.symbol,
    horizon: opts.horizon,
    side: opts.side,
    active: true,
    last_price: opts.lastPrice,
    last_confidence: opts.report.confidence,
    last_action: opts.report.action,
    last_thesis: opts.report,
    invalidation: inv,
    updated_at: new Date().toISOString(),
  };

  if (current) {
    const { data, error } = await db.from("watches").update(payload).eq("id", current.id).select("*").single();
    if (error) throw error;
    return data as WatchRow;
  }

  const { data, error } = await db.from("watches").insert(payload).select("*").single();
  if (error) throw error;
  return data as WatchRow;
}

export async function listActiveWatches(chatId?: number): Promise<WatchRow[]> {
  const db = getServiceDb();
  let q = db.from("watches").select("*").eq("active", true).order("updated_at", { ascending: false });
  if (chatId !== undefined) q = q.eq("chat_id", chatId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WatchRow[];
}

export async function getWatch(id: string): Promise<WatchRow | null> {
  const db = getServiceDb();
  const { data, error } = await db.from("watches").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as WatchRow) ?? null;
}

export async function latestWatch(chatId: number): Promise<WatchRow | null> {
  const db = getServiceDb();
  const { data, error } = await db
    .from("watches")
    .select("*")
    .eq("chat_id", chatId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as WatchRow) ?? null;
}

export async function deactivateWatch(id: string, action?: string): Promise<WatchRow | null> {
  const db = getServiceDb();
  const patch: Record<string, unknown> = {
    active: false,
    updated_at: new Date().toISOString(),
  };
  if (action) patch.last_action = action;
  const { data, error } = await db.from("watches").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as WatchRow;
}

export async function updateWatchSnapshot(
  id: string,
  patch: Partial<Pick<WatchRow, "last_price" | "last_confidence" | "last_action" | "last_thesis" | "invalidation" | "active">>,
): Promise<WatchRow> {
  const db = getServiceDb();
  const { data, error } = await db
    .from("watches")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as WatchRow;
}

export function nextInterval(pref: CheckEvery): CheckEvery {
  if (pref === "15m") return "1h";
  if (pref === "1h") return "4h";
  return "15m";
}
