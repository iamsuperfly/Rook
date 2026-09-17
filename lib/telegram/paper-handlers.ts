import { agentHubTicker } from "@/lib/bitget/agent-market";
import { scoutSymbol } from "@/lib/bitget/scout";
import { getPaperRun, listPaperRuns, openPaperRun, updatePaperRun } from "@/lib/db/paper";
import { dbConfigured } from "@/lib/db/supabase";
import { getWatch } from "@/lib/db/watches";
import { scorePaper } from "@/lib/desk/paper";
import type { JudgeReport } from "@/lib/types";
import { sendMessage } from "./bot";
import { paperListKeyboard, paperKeyboard } from "./keyboards";
import { paperCard, paperListText } from "./paper-format";
import { patchConv } from "./state";

async function entryPrice(symbol: string): Promise<number> {
  const hub = await agentHubTicker(symbol);
  if (hub && Number.isFinite(hub.last)) return hub.last;
  return (await scoutSymbol(symbol)).last;
}

export async function showPaper(chatId: number): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Supabase is not configured — no paper book.");
    return;
  }
  const rows = await listPaperRuns(chatId, false);
  await sendMessage(chatId, paperListText(rows), {
    reply_markup: rows.length ? paperListKeyboard(rows.map((r) => r.id)) : undefined,
  });
}

export async function callLiveFromReport(
  chatId: number,
  report: JudgeReport,
  side: string,
  watchId?: string | null,
): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Supabase is not configured — cannot freeze a paper snapshot.");
    return;
  }
  const entry = await entryPrice(report.symbol);
  const run = await openPaperRun({
    chatId,
    watchId,
    symbol: report.symbol,
    horizon: report.horizon,
    side: side || report.bias || "decide",
    entry,
    report,
  });
  patchConv(chatId, { lastPaperId: run.id });
  await sendMessage(
    chatId,
    paperCard(run) + "\n\nSnapshot frozen. Still no order on Bitget.",
    { reply_markup: paperKeyboard(run.id) },
  );
}

export async function handlePaperAct(chatId: number, act: string, id: string): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Database not configured.");
    return;
  }
  const run = await getPaperRun(id);
  if (!run || run.chat_id !== chatId) {
    await sendMessage(chatId, "Paper run not found.");
    return;
  }
  if (act === "open") {
    await sendMessage(chatId, paperCard(run), { reply_markup: paperKeyboard(run.id) });
    return;
  }
  if (act === "stop") {
    const last = run.last_price ?? run.entry_price;
    const scored = scorePaper(run, Number(last));
    const closed = await updatePaperRun(id, {
      status: "stopped",
      pnl_pct: scored.pnl_pct,
      last_price: Number(last),
      close_reason: "Human stopped paper.",
      closed_at: new Date().toISOString(),
    });
    await sendMessage(chatId, paperCard(closed));
  }
}

export async function callLiveFromWatch(chatId: number, watchId: string): Promise<void> {
  const watch = await getWatch(watchId);
  if (!watch || watch.chat_id !== chatId || !watch.last_thesis) {
    await sendMessage(chatId, "Watch/thesis not found.");
    return;
  }
  await callLiveFromReport(chatId, watch.last_thesis, watch.side, watch.id);
}
