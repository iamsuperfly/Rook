import { runCheckPass } from "@/lib/desk/check";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  if (!secret || header !== secret) {
    return new Response("unauthorized", { status: 401 });
  }
  const url = new URL(req.url);
  const chatIdRaw = url.searchParams.get("chat_id");
  const force = url.searchParams.get("force") === "1";
  const chatId = chatIdRaw ? Number(chatIdRaw) : undefined;
  try {
    const results = await runCheckPass({
      chatId: chatId && Number.isFinite(chatId) ? chatId : undefined,
      force,
    });
    return Response.json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error("[check-route]", err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "check_failed" }, { status: 500 });
  }
}
