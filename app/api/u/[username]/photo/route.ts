import { NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/db/watches";
import { dbConfigured } from "@/lib/db/supabase";
import { fetchTelegramFile } from "@/lib/telegram/profile";
import { normalizePublicUsername } from "@/lib/web/site";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const slug = normalizePublicUsername(username);
  if (!slug || !dbConfigured()) return new NextResponse(null, { status: 404 });
  const user = await getUserByUsername(slug);
  if (!user?.photo_file_id) return new NextResponse(null, { status: 404 });
  const file = await fetchTelegramFile(user.photo_file_id);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file.bytes, {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}
