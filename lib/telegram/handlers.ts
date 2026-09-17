import { healthCheckBtc, scoutSymbol } from "@/lib/bitget/scout";
import { runCheckPass } from "@/lib/desk/check";
import { runDebate } from "@/lib/desk/debate";
import { dbConfigured } from "@/lib/db/supabase";
import {
  deactivateWatch,
  ensureUser,
  getUser,
  getWatch,
  latestWatch,
  listActiveWatches,
  nextInterval,
  updateUser,
  upsertWatch,
} from "@/lib/db/watches";
import type { Horizon, JudgeReport, Side } from "@/lib/types";
import { answerCallback, sendMessage, type TgCallback, type TgMessage, type TgUpdate } from "./bot";
import {
  alertText,
  helpText,
  sectionCard,
  settingsText,
  snapshotLine,
  thesisCard,
  watchesText,
  welcomeText,
  wrongCard,
} from "./format";
import {
  BTN,
  CB,
  horizonKeyboard,
  isMainMenuLabel,
  marketKeyboard,
  settingsKeyboard,
  sideKeyboard,
  thesisKeyboard,
  watchAlertKeyboard,
  watchesListKeyboard,
} from "./keyboards";
import { callLiveFromReport, callLiveFromWatch, handlePaperAct, showPaper } from "./paper-handlers";
import { getConv, patchConv, setConv } from "./state";

function isHorizon(v: string): v is Horizon {
  return v === "24h" || v === "7d" || v === "30d";
}

function isSide(v: string): v is Side {
  return v === "long" || v === "short" || v === "decide";
}

async function safeDb<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!dbConfigured()) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.error("[db]", err);
    return fallback;
  }
}

async function home(chatId: number, text = welcomeText()): Promise<void> {
  setConv(chatId, { ...getConv(chatId), step: "idle" });
  await sendMessage(chatId, text);
}

async function startThesis(chatId: number): Promise<void> {
  setConv(chatId, { step: "await_horizon" });
  await sendMessage(chatId, "<b>NEW THESIS</b>\nPick a horizon.", { reply_markup: horizonKeyboard() });
}

async function runThesis(chatId: number, symbol: string): Promise<void> {
  const conv = getConv(chatId);
  const horizon = conv.horizon ?? "7d";
  const side = conv.side ?? "decide";
  await sendMessage(chatId, `Scouting <b>${symbol}</b> on Bitget…`);
  let snap;
  try {
    snap = await scoutSymbol(symbol);
  } catch {
    const ok = await healthCheckBtc();
    await sendMessage(
      chatId,
      ok
        ? `Symbol <b>${symbol}</b> was not found on Bitget public spot. BTCUSDT health-check passed, so the desk is up — try BTCUSDT or RNVDAUSDT.`
        : `Symbol <b>${symbol}</b> was not found, and BTCUSDT health-check also failed. Bitget public API may be down.`,
    );
    return;
  }

  await sendMessage(chatId, `${snapshotLine(snap)}\n\nDebating bull / bear, then Judge…`);
  try {
    const bundle = await runDebate({ symbol: snap.symbol, horizon, side, snapshot: snap });
    patchConv(chatId, { step: "idle", symbol: snap.symbol, lastReport: bundle.report });
    await sendMessage(chatId, thesisCard(bundle.report, snap), { reply_markup: thesisKeyboard() });
  } catch (err) {
    console.error("[thesis]", err);
    await sendMessage(
      chatId,
      `Desk failed: ${err instanceof Error ? err.message : "unknown"}\nSnapshot still stands.\n${snapshotLine(snap)}`,
    );
  }
}

async function handleText(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  if (!text) return;

  if (dbConfigured()) {
    await safeDb(() => ensureUser(chatId), null);
  }

  if (text === "/start" || text === BTN.mainMenu || text === "/menu") {
    await home(chatId);
    return;
  }
  if (text === "/help" || text === BTN.help) {
    await sendMessage(chatId, helpText());
    return;
  }
  if (text === "/settings" || text === BTN.settings) {
    await showSettings(chatId);
    return;
  }
  if (text === "/thesis" || text === BTN.newThesis) {
    await startThesis(chatId);
    return;
  }
  if (text === BTN.myWatches || text === "/watches") {
    await showWatches(chatId);
    return;
  }
  if (text === BTN.myPaper || text === "/paper") {
    await showPaper(chatId);
    return;
  }
  if (text === BTN.lastReport || text === "/last") {
    await showLast(chatId);
    return;
  }
  if (text === BTN.checkNow || text === "/check") {
    await sendMessage(chatId, "Running check on watches + paper…");
    try {
      const results = await runCheckPass({ chatId, force: true });
      if (!results.length) {
        await sendMessage(chatId, "No active watches or paper runs to check.");
        return;
      }
      const lines = results.map((r) => `${r.symbol}: ${r.silent ? "silent price update" : r.action} (${r.reason})`);
      await sendMessage(chatId, `<b>CHECK NOW</b>\n${lines.join("\n")}`);
    } catch (err) {
      await sendMessage(chatId, `Check failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    return;
  }

  if (isMainMenuLabel(text)) {
    await home(chatId);
    return;
  }

  const conv = getConv(chatId);
  if (conv.step === "await_custom_symbol") {
    await runThesis(chatId, text);
    return;
  }

  if (text.startsWith("/")) {
    await home(chatId, "Unknown command. Keyboard redrawn.");
    return;
  }

  await sendMessage(chatId, "Use the persistent keyboard. Tap NEW THESIS to start a desk cycle.");
}

async function showSettings(chatId: number): Promise<void> {
  const user = await safeDb(() => getUser(chatId), null);
  await sendMessage(chatId, settingsText(user?.alerts_on ?? true, user?.check_every ?? "15m"), {
    reply_markup: settingsKeyboard(),
  });
}

async function showWatches(chatId: number): Promise<void> {
  const rows = await safeDb(() => listActiveWatches(chatId), []);
  await sendMessage(chatId, watchesText(rows), {
    reply_markup: rows.length ? watchesListKeyboard(rows.map((r) => r.id)) : undefined,
  });
}

async function showLast(chatId: number): Promise<void> {
  const conv = getConv(chatId);
  if (conv.lastReport) {
    await sendMessage(chatId, thesisCard(conv.lastReport), { reply_markup: thesisKeyboard() });
    return;
  }
  const row = await safeDb(() => latestWatch(chatId), null);
  if (row?.last_thesis) {
    patchConv(chatId, { lastReport: row.last_thesis, lastWatchId: row.id, symbol: row.symbol });
    await sendMessage(chatId, thesisCard(row.last_thesis), { reply_markup: thesisKeyboard() });
    return;
  }
  await sendMessage(chatId, "No last report yet. Tap NEW THESIS.");
}

async function handleCallback(cb: TgCallback): Promise<void> {
  const chatId = cb.message?.chat.id ?? cb.from.id;
  const data = cb.data ?? "";
  await answerCallback(cb.id);

  if (data === CB.menu) {
    await home(chatId);
    return;
  }
  if (data === CB.help) {
    await sendMessage(chatId, helpText());
    return;
  }
  if (data === CB.settings) {
    await showSettings(chatId);
    return;
  }

  if (data.startsWith("th:h:")) {
    const h = data.slice(5);
    if (!isHorizon(h)) return;
    patchConv(chatId, { horizon: h, step: "await_side" });
    await sendMessage(chatId, `Horizon <b>${h}</b>. Side?`, { reply_markup: sideKeyboard() });
    return;
  }

  if (data.startsWith("th:s:")) {
    const s = data.slice(5);
    if (!isSide(s)) return;
    patchConv(chatId, { side: s, step: "await_market" });
    await sendMessage(chatId, `Side <b>${s.toUpperCase()}</b>. Market?`, { reply_markup: marketKeyboard() });
    return;
  }

  if (data.startsWith("th:m:")) {
    const m = data.slice(5);
    if (m === "CUSTOM") {
      patchConv(chatId, { step: "await_custom_symbol" });
      await sendMessage(chatId, "Send the symbol in chat (BTCUSDT, NVDAUSDT, RNVDAUSDT…).");
      return;
    }
    await runThesis(chatId, m);
    return;
  }

  if (data.startsWith("card:")) {
    await handleCard(chatId, data.slice(5));
    return;
  }

  if (data.startsWith("w:")) {
    const parts = data.split(":");
    const act = parts[1];
    const id = parts.slice(2).join(":");
    await handleWatchAct(chatId, act, id);
    return;
  }

  if (data.startsWith("p:")) {
    const parts = data.split(":");
    const act = parts[1];
    const id = parts.slice(2).join(":");
    await handlePaperAct(chatId, act, id);
    return;
  }

  if (data === CB.setAlerts) {
    const user = await safeDb(async () => {
      await ensureUser(chatId);
      const cur = await getUser(chatId);
      return updateUser(chatId, { alerts_on: !(cur?.alerts_on ?? true) });
    }, null);
    await sendMessage(chatId, settingsText(user?.alerts_on ?? true, user?.check_every ?? "15m"), {
      reply_markup: settingsKeyboard(),
    });
    return;
  }

  if (data === CB.setEvery) {
    const user = await safeDb(async () => {
      await ensureUser(chatId);
      const cur = await getUser(chatId);
      return updateUser(chatId, { check_every: nextInterval(cur?.check_every ?? "15m") });
    }, null);
    await sendMessage(chatId, settingsText(user?.alerts_on ?? true, user?.check_every ?? "15m"), {
      reply_markup: settingsKeyboard(),
    });
  }
}

async function handleCard(chatId: number, kind: string): Promise<void> {
  const conv = getConv(chatId);
  const report = conv.lastReport;
  if (!report) {
    await showLast(chatId);
    return;
  }

  if (kind === "bull") {
    await sendMessage(chatId, sectionCard("BULL CASE", report.bull_summary), { reply_markup: thesisKeyboard() });
    return;
  }
  if (kind === "bear") {
    await sendMessage(chatId, sectionCard("BEAR CASE", report.bear_summary), { reply_markup: thesisKeyboard() });
    return;
  }
  if (kind === "wrong") {
    await sendMessage(chatId, wrongCard(report), { reply_markup: thesisKeyboard() });
    return;
  }
  if (kind === "refresh") {
    if (!conv.symbol) {
      await sendMessage(chatId, "No symbol in session. Start NEW THESIS.");
      return;
    }
    await runThesis(chatId, conv.symbol);
    return;
  }
  if (kind === "live") {
    try {
      await callLiveFromReport(chatId, report, conv.side ?? report.bias, conv.lastWatchId);
    } catch (err) {
      await sendMessage(chatId, `CALL LIVE failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
    return;
  }
  if (kind === "watch") {
    if (!dbConfigured()) {
      await sendMessage(chatId, "Supabase is not configured yet — cannot persist the watch.");
      return;
    }
    try {
      let last = 0;
      try {
        last = (await scoutSymbol(report.symbol)).last;
      } catch {
        last = report.invalidation_price ?? 0;
      }
      const row = await upsertWatch({
        chatId,
        symbol: report.symbol,
        horizon: report.horizon,
        side: conv.side ?? report.bias,
        report,
        lastPrice: last,
      });
      patchConv(chatId, { lastWatchId: row.id });
      await sendMessage(chatId, `Watching <b>${report.symbol}</b> ${report.horizon}. I will not place an order.`, {
        reply_markup: watchAlertKeyboard(row.id),
      });
    } catch (err) {
      await sendMessage(chatId, `Could not store watch: ${err instanceof Error ? err.message : "unknown"}`);
    }
    return;
  }
  if (kind === "reject") {
    const id = conv.lastWatchId;
    if (id && dbConfigured()) {
      await safeDb(() => deactivateWatch(id, "reject"), null);
    }
    await sendMessage(chatId, "Thesis rejected. Not watching.");
  }
}

async function handleWatchAct(chatId: number, act: string, id: string): Promise<void> {
  if (!dbConfigured()) {
    await sendMessage(chatId, "Database not configured.");
    return;
  }
  if (act === "live") {
    await callLiveFromWatch(chatId, id);
    return;
  }
  const watch = await getWatch(id);
  if (!watch || watch.chat_id !== chatId) {
    await sendMessage(chatId, "Watch not found.");
    return;
  }
  if (act === "open") {
    if (watch.last_thesis) {
      patchConv(chatId, { lastReport: watch.last_thesis, lastWatchId: watch.id, symbol: watch.symbol });
      await sendMessage(chatId, thesisCard(watch.last_thesis), { reply_markup: thesisKeyboard() });
    } else {
      await sendMessage(chatId, "No stored thesis on that watch.");
    }
    return;
  }
  if (act === "off") {
    await deactivateWatch(id, "call_off");
    await sendMessage(
      chatId,
      alertText({
        symbol: watch.symbol,
        prevConf: watch.last_confidence,
        nextConf: watch.last_confidence ?? 0,
        action: "call_off",
        last: Number(watch.last_price ?? 0),
        inv: watch.invalidation?.price ?? null,
        reason: "Human called it off. Watch closed.",
      }),
    );
    return;
  }
  if (act === "keep") {
    await sendMessage(chatId, `Still watching <b>${watch.symbol}</b>.`);
  }
}

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }
  if (update.message) {
    await handleText(update.message);
  }
}

export { handleText };
export type { JudgeReport };
