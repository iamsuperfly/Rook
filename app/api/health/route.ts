import { healthCheckBtc } from "@/lib/bitget/scout";
import { dbConfigured } from "@/lib/db/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let bitget = false;
  try {
    bitget = await healthCheckBtc();
  } catch {
    bitget = false;
  }
  return Response.json({
    ok: true,
    service: "rook",
    time: new Date().toISOString(),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    supabase: dbConfigured(),
    groqA: Boolean(process.env.GROQ_API_KEY_A),
    groqB: Boolean(process.env.GROQ_API_KEY_B),
    bitget,
  });
}
