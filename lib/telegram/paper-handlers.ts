import { agentHubTicker } from "@/lib/bitget/agent-market";
import { scoutSymbol } from "@/lib/bitget/scout";
import {
  addPaperMargin,
  countOpenPaperRuns,
  getPaperRun,
  listClosedPaperRuns,
  listOpenPaperRuns,
  openPaperRun,
  settlePaperClose,
} from "@/lib/db/paper";
import { claimDaily, claimInitial, paperWalletView, PaperFundsError } from "@/lib/db/paper-wallet";
import { dbConfigured } from "@/lib/db/supabase";
import { getWatch } from "@/lib/db/watches";
import { MAX_OPEN_PAPER, PaperLimitError, paperBias, resolveCallLiveSide, scorePaper } from "@/lib/desk/paper";
import { PAPER_MIN_MARGIN, isPaperLeverage, paperExposure, stressPosition } from "@/lib/desk/paper-sim";
import { describeError } from "@/lib/desk/errors";
import type { JudgeReport } from "@/lib/types";
import { sendMessage } from "./bot";
import { fmtNum, fmtPct } from "./format";
import {
  openPaperEmptyKeyboard,
  paperAddMarginKeyboard,
  paperBiasKeyboard,
  paperKeyboard,
  paperLeverageKeyboard,
  paperLimitKeyboard,
  paperListKeyboard,
  paperMarginKeyboard,
  recordsListKeyboard,
  walletKeyboard,
} from "./keyboards";
import {
  leveragePromptText,
  marginPromptText,
  noBiasText,
  paperCard,
  paperLimitText,
  paperListText,
  recordsListText,
  walletText,
} from "./paper-format";
import { getConv, patchConv } from "./state";

function fundsMessage(err: unknown): string {
  if (err instanceof PaperFundsError) {
    if (err.message === "insufficient_available") return "Not enough available Paper USDT. Claim or pick a smaller margin.";
    if (err.message === "claim_initial_first") return "Claim the 10,000 initial Paper USDT first.";
    if (err.message === "initial_already_claimed") return "Initial claim already taken.";
    if (err.message === "daily_already_claimed") return "Daily claim already taken today (UTC).";
    if (err.message === "margin_too_small") return `Minimum isolated margin is ${PAPER_MIN_MARGIN} Paper USDT.`;
    if (err.message === "legacy_unlevered") return "This legacy paper row has no margin bucket. Stop it and open a new call.";
  }
  return describeError(err);
}

async function entryPrice(symbol: string): Promise<number> {
  const hub = await agentHubTicker(symbol);
  if (hub && Number.isFinite(hub.last)) return hub.last;
  return (await scoutSymbol(symbol)).last;
}

export async function showWallet(chatId: number): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Supabase is not configured — no paper wallet.");
    return;
  }
  try {
    const view = await paperWalletView(chatId);
    await sendMessage(chatId, walletText(view), {
      reply_markup: walletKeyboard({
        canClaimInitial: view.canClaimInitial,
        canClaimDaily: view.canClaimDaily,
      }),
    });
  } catch (err) {
    console.error("[wallet]", err);
    await sendMessage(chatId, `WALLET failed: ${describeError(err)}`);
  }
}

export async function handleWalletClaim(chatId: number, kind: "init" | "daily"): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Supabase is not configured — no paper wallet.");
    return;
  }
  try {
    if (kind === "init") await claimInitial(chatId);
    else await claimDaily(chatId);
    await showWallet(chatId);
  } catch (err) {
    await sendMessage(chatId, fundsMessage(err));
    await showWallet(chatId);
  }
}

export async function showPaper(chatId: number): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Supabase is not configured — no paper book.");
    return;
  }
  try {
    const rows = await listOpenPaperRuns(chatId);
    const wallet = await paperWalletView(chatId);
    await sendMessage(chatId, paperListText(rows, wallet), {
      reply_markup: rows.length ? paperListKeyboard(rows.map((r) => r.id)) : openPaperEmptyKeyboard(),
    });
  } catch (err) {
    console.error("[paper]", err);
    await sendMessage(chatId, `MY PAPER failed: ${describeError(err)}`);
  }
}

export async function showRecords(chatId: number): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Supabase is not configured — no paper book.");
    return;
  }
  try {
    const rows = await listClosedPaperRuns(chatId);
    await sendMessage(chatId, recordsListText(rows), {
      reply_markup: rows.length ? recordsListKeyboard(rows.map((r) => r.id)) : openPaperEmptyKeyboard(),
    });
  } catch (err) {
    console.error("[records]", err);
    await sendMessage(chatId, `RECORDS failed: ${describeError(err)}`);
  }
}

export async function promptPaperBias(chatId: number, report: JudgeReport, watchId?: string | null): Promise<void> {
  patchConv(chatId, { pendingPaper: { report, watchId: watchId ?? null } });
  await sendMessage(chatId, noBiasText(report.symbol), { reply_markup: paperBiasKeyboard() });
}

async function promptMargin(chatId: number): Promise<void> {
  const pending = getConv(chatId).pendingPaper;
  if (!pending?.report || !pending.side) {
    await sendMessage(chatId, "No pending CALL LIVE.");
    return;
  }
  const view = await paperWalletView(chatId);
  if (view.canClaimInitial) {
    await sendMessage(chatId, "Claim 10,000 Paper USDT before opening a leveraged paper call.", {
      reply_markup: walletKeyboard({ canClaimInitial: true, canClaimDaily: false }),
    });
    return;
  }
  if (view.available < PAPER_MIN_MARGIN) {
    await sendMessage(
      chatId,
      `Available ${view.available} is below the ${PAPER_MIN_MARGIN} minimum. Claim daily or stop a position.`,
      { reply_markup: walletKeyboard({ canClaimInitial: false, canClaimDaily: view.canClaimDaily }) },
    );
    return;
  }
  patchConv(chatId, { step: "await_paper_margin" });
  await sendMessage(chatId, marginPromptText(pending.report.symbol, view.available), {
    reply_markup: paperMarginKeyboard(),
  });
}

export async function handlePaperMargin(chatId: number, raw: string): Promise<void> {
  const pending = getConv(chatId).pendingPaper;
  if (!pending?.report || !pending.side) {
    await sendMessage(chatId, "No pending CALL LIVE. Open a thesis first.");
    return;
  }
  const margin = Number(raw);
  if (!Number.isFinite(margin) || margin < PAPER_MIN_MARGIN) {
    await sendMessage(chatId, `Pick a margin of at least ${PAPER_MIN_MARGIN}.`);
    return;
  }
  const view = await paperWalletView(chatId);
  if (margin > view.available) {
    await sendMessage(chatId, `Only ${view.available} available. Pick a smaller margin.`);
    return;
  }
  patchConv(chatId, {
    step: "await_paper_leverage",
    pendingPaper: { ...pending, marginUsdt: margin },
  });
  await sendMessage(chatId, leveragePromptText(pending.report.symbol, margin), {
    reply_markup: paperLeverageKeyboard(),
  });
}

export async function handlePaperLeverage(chatId: number, raw: string): Promise<void> {
  const pending = getConv(chatId).pendingPaper;
  if (!pending?.report || !pending.side || pending.marginUsdt == null) {
    await sendMessage(chatId, "Pick margin first.");
    return;
  }
  const lev = Number(raw);
  if (!isPaperLeverage(lev)) {
    await sendMessage(chatId, "Leverage must be 1, 2, 3, 5, or 10.");
    return;
  }
  await finishOpen(chatId, pending.marginUsdt, lev);
}

async function finishOpen(chatId: number, marginUsdt: number, leverage: number): Promise<void> {
  const pending = getConv(chatId).pendingPaper;
  if (!pending?.report || !pending.side) {
    await sendMessage(chatId, "No pending CALL LIVE.");
    return;
  }
  try {
    const entry = pending.entry ?? (await entryPrice(pending.report.symbol));
    const run = await openPaperRun({
      chatId,
      watchId: pending.watchId,
      symbol: pending.report.symbol,
      horizon: pending.report.horizon,
      side: pending.side,
      entry,
      report: pending.report,
      marginUsdt,
      leverage,
    });
    patchConv(chatId, { step: "idle", lastPaperId: run.id, pendingPaper: undefined });
    const exposure = paperExposure(marginUsdt, leverage);
    await sendMessage(
      chatId,
      paperCard(run) +
        `\n\nIsolated paper ${leverage}x on ${exposure} notional. Still no order on Bitget.`,
      { reply_markup: paperKeyboard(run.id) },
    );
  } catch (err) {
    if (err instanceof PaperLimitError) {
      await sendMessage(chatId, paperLimitText(), { reply_markup: paperLimitKeyboard() });
      return;
    }
    await sendMessage(chatId, `CALL LIVE failed: ${fundsMessage(err)}`);
  }
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
  try {
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
    const entry = await entryPrice(report.symbol);
    patchConv(chatId, {
      pendingPaper: { report, watchId: watchId ?? null, side, entry },
    });
    await promptMargin(chatId);
  } catch (err) {
    console.error("[call-live]", err);
    await sendMessage(chatId, `CALL LIVE failed: ${describeError(err)}`);
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
  if (act === "add") {
    if (run.status !== "open") {
      await sendMessage(chatId, paperCard(run));
      return;
    }
    patchConv(chatId, { step: "await_add_margin", lastPaperId: run.id });
    await sendMessage(chatId, "Add isolated margin. Pick an amount or type a number.", {
      reply_markup: paperAddMarginKeyboard(run.id),
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
    const closed = await settlePaperClose({
      id,
      chatId,
      status: "stopped",
      last: Number(last),
      pnlPct: scored.pnl_pct,
      pnlUsdt: scored.pnl_usdt,
      closeReason: "Human stopped paper.",
    });
    await sendMessage(chatId, paperCard(closed));
  }
}

export async function handleAddMargin(chatId: number, raw: string, id?: string): Promise<void> {
  const paperId = id ?? getConv(chatId).lastPaperId;
  if (!paperId) {
    await sendMessage(chatId, "No paper call selected.");
    return;
  }
  const amount = Number(raw);
  try {
    const run = await addPaperMargin(paperId, chatId, amount);
    patchConv(chatId, { step: "idle" });
    await sendMessage(chatId, paperCard(run) + "\n\nMargin added. Liquidation price moved.", {
      reply_markup: paperKeyboard(run.id),
    });
  } catch (err) {
    await sendMessage(chatId, `ADD MARGIN failed: ${fundsMessage(err)}`);
  }
}

export async function handlePaperStress(chatId: number, id: string): Promise<void> {
  const run = await getPaperRun(id);
  if (!run || run.chat_id !== chatId) {
    await sendMessage(chatId, "Paper run not found.");
    return;
  }
  const last = Number(run.last_price ?? run.entry_price);
  const stress = stressPosition({
    side: run.side,
    entry: Number(run.entry_price),
    last,
    marginUsdt: Number(run.margin_usdt ?? 0),
    leverage: Number(run.leverage ?? 1),
    extraMargin: 50,
  });
  const lines = stress.rows.map((row) => {
    const mark = row.wouldLiquidate ? "LIQ" : "ok";
    return `−${row.adversePct}% → last ${fmtNum(row.last)} · ${fmtPct(row.returnOnMarginPct)} · ${mark}`;
  });
  await sendMessage(
    chatId,
    [
      `<b>STRESS // ${run.symbol}</b>`,
      `Current LP ${fmtNum(stress.baselineLiq)}`,
      stress.withExtraLiq != null ? `LP after +50 margin ${fmtNum(stress.withExtraLiq)}` : "",
      "",
      ...lines,
      "",
      "<i>Numbers only. Rook does not add margin or close this call.</i>",
    ]
      .filter(Boolean)
      .join("\n"),
    { reply_markup: paperKeyboard(run.id) },
  );
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

export async function handlePaperTextAmount(chatId: number, text: string): Promise<boolean> {
  const step = getConv(chatId).step;
  if (step === "await_paper_margin") {
    await handlePaperMargin(chatId, text);
    return true;
  }
  if (step === "await_add_margin") {
    await handleAddMargin(chatId, text);
    return true;
  }
  return false;
}
