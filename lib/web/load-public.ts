import { getPaperRunForChat, listClosedPaperRuns, listOpenPaperRuns } from "@/lib/db/paper";
import { getUserByUsername } from "@/lib/db/watches";
import { dbConfigured } from "@/lib/db/supabase";
import type { PaperRunRow, UserRow } from "@/lib/types";
import { normalizePublicUsername } from "./site";

export interface PublicProfile {
  username: string;
  firstName: string | null;
  hasPhoto: boolean;
  chatId: number;
}

export function asPublicProfile(user: UserRow): PublicProfile | null {
  const username = normalizePublicUsername(user.username);
  if (!username) return null;
  return {
    username,
    firstName: user.first_name ?? null,
    hasPhoto: Boolean(user.photo_file_id),
    chatId: user.chat_id,
  };
}

export async function loadPublicBook(username: string): Promise<{
  profile: PublicProfile;
  closed: PaperRunRow[];
  open: PaperRunRow[];
} | null> {
  if (!dbConfigured()) return null;
  const user = await getUserByUsername(username);
  if (!user) return null;
  const profile = asPublicProfile(user);
  if (!profile) return null;
  const [closed, open] = await Promise.all([
    listClosedPaperRuns(user.chat_id),
    listOpenPaperRuns(user.chat_id),
  ]);
  return { profile, closed, open };
}

export async function loadPublicReceipt(
  username: string,
  recordId: string,
): Promise<{ profile: PublicProfile; run: PaperRunRow } | null> {
  if (!dbConfigured()) return null;
  const user = await getUserByUsername(username);
  if (!user) return null;
  const profile = asPublicProfile(user);
  if (!profile) return null;
  const run = await getPaperRunForChat(recordId, user.chat_id);
  if (!run) return null;
  return { profile, run };
}
