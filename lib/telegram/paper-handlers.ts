import { agentHubTicker } from "@/lib/bitget/agent-market";
import { scoutSymbol } from "@/lib/bitget/scout";
import {
  countOpenPaperRuns,
  getPaperRun,
  listClosedPaperRuns,
  listOpenPaperRuns,
  openPaperRun,
  updatePaperRun,
} from "@/lib/db/paper";
import { dbConfigured } from "@/lib/db/supabase";
import { getWatch } from "@/lib/db/watches";
import { MAX_OPEN_PAPER, PaperLimitError, paperBias, resolveCallLiveSide, scorePaper } from "@/lib/desk/paper";
import type { JudgeReport } from "@/lib/types";
import { sendMessage } from "./bot";
import {
  openPaperEmptyKeyboard,
  paperBiasKeyboard,
  paperKeyboard,
  paperLimitKeyboard,
  paperListKeyboard,
  recordsListKeyboard,
} from "./keyboards";
import { noBiasText, paperCard, paperLimitText, paperListText, recordsListText } from "./paper-format";
import { getConv, patchConv } from "./state";

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
  const rows = await listOpenPaperRuns(chatId);
  await sendMessage(chatId, paperListText(rows), {
    reply_markup: rows.length ? paperListKeyboard(rows.map((r) => r.id)) : openPaperEmptyKeyboard(),
  });
}

export async function showRecords(chatId: number): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Supabase is not configured — no paper book.");
    return;
  }
  const rows = await listClosedPaperRuns(chatId);
  await sendMessage(chatId, recordsListText(rows), {
    reply_markup: rows.length ? recordsListKeyboard(rows.map((r) => r.id)) : openPaperEmptyKeyboard(),
  });
}

export async function promptPaperBias(chatId: number, report: JudgeReport, watchId?: string | null): Promise<void> {
  patchConv(chatId, { pendingPaper: { report, watchId: watchId ?? null } });
  await sendMessage(chatId, noBiasText(report.symbol), { reply_markup: paperBiasKeyboard() });
}

export async function callLiveFromReport(
  chatId: number,
  report: JudgeReport,
  hintedSide?: string | null,
  watchId?: string | null,
): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Supabase is not configured — cannot freeze a paper snapshot.");
    return;
  }
  const side = resolveCallLiveSide(paperBias(report), hintedSide);
  if (!side) {
    await promptPaperBias(chatId, report, watchId);
    return;
  }
  const open = await countOpenPaperRuns(chatId);
  if (open >= MAX_OPEN_PAPER) {
    await sendMessage(chatId, paperLimitText(), { reply_markup: paperLimitKeyboard() });
    return;
  }
  try {
    const entry = await entryPrice(report.symbol);
    const run = await openPaperRun({
      chatId,
      watchId,
      symbol: report.symbol,
      horizon: report.horizon,
      side,
      entry,
      report,
    });
    patchConv(chatId, { lastPaperId: run.id, pendingPaper: undefined });
    await sendMessage(chatId, paperCard(run) + "\n\nSnapshot frozen. Still no order on Bitget.", {
      reply_markup: paperKeyboard(run.id),
    });
  } catch (err) {
    if (err instanceof PaperLimitError) {
      await sendMessage(chatId, paperLimitText(), { reply_markup: paperLimitKeyboard() });
      return;
    }
    await sendMessage(chatId, `CALL LIVE failed: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

export async function handlePaperDir(chatId: number, dir: string): Promise<void> {
  const pending = getConv(chatId).pendingPaper;
  if (!pending?.report) {
    await sendMessage(chatId, "No pending CALL LIVE. Open a thesis first.");
    return;
  }
  if (dir !== "long" && dir !== "short") {
    await sendMessage(chatId, "Pick LONG or SHORT.");
    return;
  }
  await callLiveFromReport(chatId, pending.report, dir, pending.watchId);
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
    await sendMessage(chatId, paperCard(run), {
      reply_markup: run.status === "open" ? paperKeyboard(run.id) : recordsListKeyboard([run.id]),
    });
    return;
  }
  if (act === "stop") {
    if (run.status !== "open") {
      await sendMessage(chatId, paperCard(run));
      return;
    }
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
  const hint =
    watch.last_thesis.bias === "long" || watch.last_thesis.bias === "short" ? watch.last_thesis.bias : null;
  await callLiveFromReport(chatId, watch.last_thesis, hint, watch.id);
}
