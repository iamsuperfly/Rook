import { handleUpdate } from "@/lib/telegram/handlers";
import type { TgUpdate } from "@/lib/telegram/bot";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function unauthorized(): Response {
  return new Response("unauthorized", { status: 401 });
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) return unauthorized();
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  try {
    await handleUpdate(update);
  } catch (err) {
    console.error("[webhook]", err);
  }
  return Response.json({ ok: true });
}

export async function GET(): Promise<Response> {
  return Response.json({ ok: true, service: "rook-telegram" });
}
