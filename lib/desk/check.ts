import { moveVsSnapshotPct, scoutSymbol } from "@/lib/bitget/scout";
import { agentHubTicker } from "@/lib/bitget/agent-market";
import { dbConfigured } from "@/lib/db/supabase";
import { listOpenPaperRuns, settlePaperClose, updatePaperRun } from "@/lib/db/paper";
import { getUser, getWatch, listActiveWatches, updateWatchSnapshot } from "@/lib/db/watches";
import { sendMessage } from "@/lib/telegram/bot";
import { alertText, confirmationAlertText } from "@/lib/telegram/format";
import { paperCard } from "@/lib/telegram/paper-format";
import { paperKeyboard, watchAlertKeyboard } from "@/lib/telegram/keyboards";
import type { ConfirmationBlob, JudgeReport, Side, WatchRow } from "@/lib/types";
import {
  confirmationBlobFromReport,
  crossedConfirmation,
  markConfirmed,
  storedConfirmation,
} from "./confirmation";
import { scorePaper } from "./paper";
import { runDebate, shouldRewriteJudge } from "./debate";
import { alertInvalidationPrice, storedInvalidationPrice, watchCrossed, watchDirection } from "./watch-eval";

export interface CheckResult {
  id: string;
  symbol: string;
  chatId: number;
  silent: boolean;
  action: string;
  last: number;
  reason: string;
  evaluatedInv?: number | null;
  confirmationState?: string;
}

function thesisSnapshotLast(watch: WatchRow): number | null {
  return watch.last_price;
}

async function lastPrice(symbol: string): Promise<number> {
  const hub = await agentHubTicker(symbol);
  if (hub && Number.isFinite(hub.last)) return hub.last;
  return (await scoutSymbol(symbol)).last;
}

function advanceConfirmation(opts: {
  side: string | null;
  last: number;
  blob: ConfirmationBlob | null;
}): { blob: ConfirmationBlob | null; newlyConfirmed: boolean } {
  if (!opts.blob) return { blob: null, newlyConfirmed: false };
  if (opts.blob.state === "confirmed") return { blob: opts.blob, newlyConfirmed: false };
  if (crossedConfirmation(opts.side, opts.last, opts.blob.price)) {
    return { blob: markConfirmed(opts.blob), newlyConfirmed: true };
  }
  return { blob: opts.blob, newlyConfirmed: false };
}

export async function evaluateWatch(watch: WatchRow, forceRewrite = false): Promise<CheckResult> {
  const snap = await scoutSymbol(watch.symbol);
  const storedInv = storedInvalidationPrice(watch);
  const crossed = watchCrossed(watch, snap.last);
  const move = moveVsSnapshotPct(snap.last, thesisSnapshotLast(watch));
  const rewrite = shouldRewriteJudge({ force: forceRewrite, crossed, moveAbsPct: move });
  const dir = watchDirection(watch);

  if (!rewrite) {
    const next = advanceConfirmation({
      side: dir,
      last: snap.last,
      blob: storedConfirmation(watch),
    });
    await updateWatchSnapshot(watch.id, {
      last_price: snap.last,
      ...(next.blob ? { confirmation: next.blob } : {}),
    });
    return {
      id: watch.id,
      symbol: watch.symbol,
      chatId: watch.chat_id,
      silent: !next.newlyConfirmed,
      action: next.newlyConfirmed ? "confirmed" : watch.last_action ?? "hold",
      last: snap.last,
      reason: next.newlyConfirmed ? "Thesis confirmation trigger printed." : "price_updated",
      evaluatedInv: storedInv,
      confirmationState: next.blob?.state,
    };
  }

  const requestedSide = (watch.side || watch.last_thesis?.bias || "decide") as Side;
  const bundle = await runDebate({
    symbol: snap.symbol,
    horizon: watch.horizon,
    side: requestedSide === "long" || requestedSide === "short" ? requestedSide : "decide",
    snapshot: snap,
    prior: watch.last_thesis ?? undefined,
    rewrite: true,
  });

  const report = bundle.report;
  const prevConf = watch.last_confidence;
  const drop = prevConf !== null && prevConf !== undefined ? prevConf - report.confidence : 0;
  let action = report.action;
  if (crossed) action = "call_off";

  const evaluatedInv = alertInvalidationPrice({
    crossed,
    storedInv,
    rewrittenInv: report.invalidation_price,
  });

  let confirmation = confirmationBlobFromReport(report, storedConfirmation(watch));
  let newlyConfirmed = false;
  if (!crossed) {
    const next = advanceConfirmation({ side: dir, last: snap.last, blob: confirmation });
    confirmation = next.blob ?? confirmation;
    newlyConfirmed = next.newlyConfirmed;
  }

  const active = action !== "call_off" && action !== "reject";
  await updateWatchSnapshot(watch.id, {
    last_price: snap.last,
    last_confidence: report.confidence,
    last_action: action,
    last_thesis: report,
    invalidation: {
      price: report.invalidation_price,
      note: report.invalidation_note,
      rules: report.i_am_wrong_if,
    },
    confirmation,
    active,
  });

  const shouldAlert =
    action !== (watch.last_action ?? "") || drop >= 15 || action === "call_off" || crossed || newlyConfirmed;

  return {
    id: watch.id,
    symbol: watch.symbol,
    chatId: watch.chat_id,
    silent: !shouldAlert,
    action: crossed ? action : newlyConfirmed ? "confirmed" : action,
    last: snap.last,
    evaluatedInv,
    confirmationState: confirmation?.state,
    reason: crossed
      ? `Invalidation crossed at ${snap.last} vs ${storedInv}`
      : newlyConfirmed
        ? "Thesis confirmation trigger printed."
        : drop >= 15
          ? `Confidence dropped ${prevConf} → ${report.confidence}`
          : report.reason || action,
  };
}

export async function notifyCheck(watch: WatchRow, result: CheckResult, report?: JudgeReport | null): Promise<void> {
  if (result.silent) return;
  const text =
    result.action === "confirmed"
      ? confirmationAlertText({
          symbol: result.symbol,
          last: result.last,
          trigger: storedConfirmation(watch)?.trigger ?? report?.confirmation_trigger ?? "",
        })
      : alertText({
          symbol: result.symbol,
          prevConf: watch.last_confidence,
          nextConf: report?.confidence ?? watch.last_confidence ?? 0,
          action: result.action,
          last: result.last,
          inv:
            result.evaluatedInv !== undefined
              ? result.evaluatedInv
              : storedInvalidationPrice(watch),
          reason: result.reason,
        });
  await sendMessage(result.chatId, text, { reply_markup: watchAlertKeyboard(watch.id) });
}

async function scoreOpenPaper(chatId?: number): Promise<CheckResult[]> {
  const runs = await listOpenPaperRuns(chatId);
  const out: CheckResult[] = [];
  for (const run of runs) {
    try {
      const last = await lastPrice(run.symbol);
      const scored = scorePaper(run, last);
      const closed = scored.status !== "open";
      const blob = storedConfirmation(run);
      const advanced = closed
        ? { blob, newlyConfirmed: false }
        : advanceConfirmation({ side: run.side, last, blob });
      const nextConf = advanced.blob;
      if (closed) {
        await settlePaperClose({
          id: run.id,
          chatId: run.chat_id,
          status: scored.status,
          last,
          pnlPct: scored.pnl_pct,
          pnlUsdt: scored.pnl_usdt,
          closeReason: scored.close_reason,
        });
        if (nextConf) await updatePaperRun(run.id, { confirmation: nextConf });
      } else {
        await updatePaperRun(run.id, {
          last_price: last,
          pnl_pct: scored.pnl_pct,
          pnl_usdt: scored.pnl_usdt,
          liquidation_price: scored.liq_price,
          ...(nextConf ? { confirmation: nextConf } : {}),
        });
      }
      const silent = !closed && !advanced.newlyConfirmed;
      if (!silent) {
        const fresh = {
          ...run,
          last_price: last,
          pnl_pct: scored.pnl_pct,
          pnl_usdt: scored.pnl_usdt,
          status: scored.status,
          close_reason: scored.close_reason,
          liquidation_price: scored.liq_price,
          liq_price: scored.liq_price,
          confirmation: nextConf,
        };
        await sendMessage(run.chat_id, paperCard(fresh), { reply_markup: paperKeyboard(run.id) });
      }
      out.push({
        id: run.id,
        symbol: run.symbol,
        chatId: run.chat_id,
        silent,
        action: closed ? scored.status : advanced.newlyConfirmed ? "confirmed" : scored.status,
        last,
        confirmationState: nextConf?.state,
        reason: scored.close_reason ?? (advanced.newlyConfirmed ? "Thesis confirmation trigger printed." : "paper_scored"),
      });
    } catch (err) {
      console.error("[check] paper failed", run.id, err);
    }
  }
  return out;
}

export async function runCheckPass(opts?: { chatId?: number; force?: boolean }): Promise<CheckResult[]> {
  if (!dbConfigured()) throw new Error("supabase_unconfigured");
  const watches = await listActiveWatches(opts?.chatId);
  const out: CheckResult[] = [];
  for (const w of watches) {
    try {
      const result = await evaluateWatch(w, Boolean(opts?.force));
      out.push(result);
      if (!result.silent) {
        const user = await getUser(w.chat_id);
        const alertsOn = user?.alerts_on ?? true;
        if (alertsOn || result.action === "call_off") {
          const fresh = await getWatch(w.id);
          await notifyCheck(w, result, fresh?.last_thesis ?? w.last_thesis);
        }
      }
    } catch (err) {
      console.error("[check] watch failed", w.id, w.symbol, err);
      out.push({
        id: w.id,
        symbol: w.symbol,
        chatId: w.chat_id,
        silent: true,
        action: "error",
        last: Number(w.last_price ?? 0),
        reason: err instanceof Error ? err.message : "check_failed",
      });
    }
  }
  const paper = await scoreOpenPaper(opts?.chatId);
  return out.concat(paper);
}
