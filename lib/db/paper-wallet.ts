import { getServiceDb } from "./supabase";
import { ensureUser } from "./watches";
import {
  PAPER_DAILY_USDT,
  PAPER_INITIAL_USDT,
  dailyClaimAvailable,
} from "@/lib/desk/paper-sim";
import type { PaperAccountRow } from "@/lib/types";

export class PaperFundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaperFundsError";
  }
}

export async function getPaperAccount(chatId: number): Promise<PaperAccountRow | null> {
  const db = getServiceDb();
  const { data, error } = await db.from("paper_accounts").select("*").eq("chat_id", chatId).maybeSingle();
  if (error) throw error;
  return (data as PaperAccountRow) ?? null;
}

export async function ensurePaperAccount(chatId: number): Promise<PaperAccountRow> {
  await ensureUser(chatId);
  const existing = await getPaperAccount(chatId);
  if (existing) return existing;
  const db = getServiceDb();
  const { data, error } = await db
    .from("paper_accounts")
    .insert({
      chat_id: chatId,
      available_usdt: 0,
      claimed_initial: false,
      last_daily_claim_at: null,
    })
    .select("*")
    .single();
  if (error) {
    const raced = await getPaperAccount(chatId);
    if (raced) return raced;
    throw error;
  }
  return data as PaperAccountRow;
}

export async function committedMarginUsdt(chatId: number): Promise<number> {
  const db = getServiceDb();
  const { data, error } = await db
    .from("paper_runs")
    .select("margin_usdt")
    .eq("chat_id", chatId)
    .eq("status", "open");
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.margin_usdt ?? 0), 0);
}

export async function paperWalletView(chatId: number): Promise<{
  account: PaperAccountRow;
  available: number;
  inPositions: number;
  paperBalance: number;
  canClaimInitial: boolean;
  canClaimDaily: boolean;
}> {
  const account = await ensurePaperAccount(chatId);
  const inPositions = await committedMarginUsdt(chatId);
  const available = Number(account.available_usdt ?? 0);
  return {
    account,
    available,
    inPositions,
    paperBalance: available + inPositions,
    canClaimInitial: !account.claimed_initial,
    canClaimDaily: account.claimed_initial && dailyClaimAvailable(account.last_daily_claim_at),
  };
}

export async function claimInitial(chatId: number): Promise<PaperAccountRow> {
  const account = await ensurePaperAccount(chatId);
  if (account.claimed_initial) throw new PaperFundsError("initial_already_claimed");
  const db = getServiceDb();
  const next = Number(account.available_usdt) + PAPER_INITIAL_USDT;
  const { data, error } = await db
    .from("paper_accounts")
    .update({
      available_usdt: next,
      claimed_initial: true,
      last_daily_claim_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId)
    .eq("claimed_initial", false)
    .select("*")
    .single();
  if (error) throw error;
  if (!data) throw new PaperFundsError("initial_already_claimed");
  return data as PaperAccountRow;
}

export async function claimDaily(chatId: number): Promise<PaperAccountRow> {
  const account = await ensurePaperAccount(chatId);
  if (!account.claimed_initial) throw new PaperFundsError("claim_initial_first");
  if (!dailyClaimAvailable(account.last_daily_claim_at)) throw new PaperFundsError("daily_already_claimed");
  const db = getServiceDb();
  const next = Number(account.available_usdt) + PAPER_DAILY_USDT;
  const { data, error } = await db
    .from("paper_accounts")
    .update({
      available_usdt: next,
      last_daily_claim_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId)
    .select("*")
    .single();
  if (error) throw error;
  return data as PaperAccountRow;
}

export async function debitAvailable(chatId: number, amount: number): Promise<PaperAccountRow> {
  if (!Number.isFinite(amount) || amount <= 0) throw new PaperFundsError("bad_amount");
  const account = await ensurePaperAccount(chatId);
  const available = Number(account.available_usdt);
  if (available + 1e-9 < amount) throw new PaperFundsError("insufficient_available");
  const db = getServiceDb();
  const { data, error } = await db
    .from("paper_accounts")
    .update({
      available_usdt: available - amount,
      updated_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId)
    .select("*")
    .single();
  if (error) throw error;
  return data as PaperAccountRow;
}

export async function creditAvailable(chatId: number, amount: number): Promise<PaperAccountRow> {
  if (!Number.isFinite(amount)) throw new PaperFundsError("bad_amount");
  const account = await ensurePaperAccount(chatId);
  const db = getServiceDb();
  const { data, error } = await db
    .from("paper_accounts")
    .update({
      available_usdt: Number(account.available_usdt) + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId)
    .select("*")
    .single();
  if (error) throw error;
  return data as PaperAccountRow;
}
