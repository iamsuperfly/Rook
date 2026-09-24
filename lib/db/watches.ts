import type {
  Horizon,
  InvalidationBlob,
  JudgeReport,
  TelegramProfilePatch,
  UserRow,
  WatchRow,
} from "@/lib/types";
import { normalizePublicUsername } from "@/lib/web/site";
import { fetchTelegramPhotoFileId } from "@/lib/telegram/profile";
import { getServiceDb } from "./supabase";

const PHOTO_TTL_MS = 24 * 60 * 60 * 1000;

export async function ensureUser(chatId: number, profile?: TelegramProfilePatch): Promise<UserRow> {
  const db = getServiceDb();
  const { data: existing, error: readErr } = await db.from("users").select("*").eq("chat_id", chatId).maybeSingle();
  if (readErr) throw readErr;
  if (!existing) {
    const { data, error } = await db
      .from("users")
      .insert({
        chat_id: chatId,
        telegram_user_id: profile?.telegramUserId ?? chatId,
      })
      .select("*")
      .single();
    if (error) throw error;
    if (profile) {
      await touchPublicProfile(chatId, profile, data as UserRow).catch((err) => console.warn("[users] profile", err));
    }
    return (await getUser(chatId)) ?? (data as UserRow);
  }
  if (profile) {
    await touchPublicProfile(chatId, profile, existing as UserRow).catch((err) => console.warn("[users] profile", err));
  }
  return ((await getUser(chatId)) ?? existing) as UserRow;
}

export async function touchPublicProfile(
  chatId: number,
  profile: TelegramProfilePatch,
  current?: UserRow | null,
): Promise<void> {
  const db = getServiceDb();
  const username = normalizePublicUsername(profile.username ?? null);
  if (username) {
    await db.from("users").update({ username: null }).neq("chat_id", chatId).ilike("username", username);
  }
  const patch: Record<string, unknown> = {
    telegram_user_id: profile.telegramUserId ?? chatId,
  };
  if (profile.username !== undefined) patch.username = username;
  if (profile.firstName !== undefined) patch.first_name = profile.firstName;
  const stale =
    !current?.photo_updated_at || Date.now() - new Date(current.photo_updated_at).getTime() > PHOTO_TTL_MS;
  if (stale || !current?.photo_file_id) {
    const userId = profile.telegramUserId ?? current?.telegram_user_id ?? chatId;
    const photo = await fetchTelegramPhotoFileId(userId);
    if (photo) {
      patch.photo_file_id = photo;
      patch.photo_updated_at = new Date().toISOString();
    }
  }
  const { error } = await db.from("users").update(patch).eq("chat_id", chatId);
  if (error) throw error;
}

export async function getUserByUsername(username: string): Promise<UserRow | null> {
  const slug = normalizePublicUsername(username);
  if (!slug) return null;
  const db = getServiceDb();
  const { data, error } = await db.from("users").select("*").ilike("username", slug).maybeSingle();
  if (error) throw error;
  return (data as UserRow) ?? null;
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
