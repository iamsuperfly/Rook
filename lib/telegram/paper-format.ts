import { MAX_OPEN_PAPER, isPaperDir, leveragedPaper, recordsStats } from "@/lib/desk/paper";
import {
  PAPER_DAILY_USDT,
  PAPER_INITIAL_USDT,
  PAPER_MIN_MARGIN,
  distanceToLiquidationPct,
  paperExposure,
  paperPnlUsdt,
  paperRiskState,
} from "@/lib/desk/paper-sim";
import type { PaperRunRow } from "@/lib/types";
import { esc, fmtNum, fmtPct, fmtUtc } from "./format";

export const PAPER_DISCLAIMER = "Paper simulation \u00b7 No real orders placed";

function sideLabel(side: string): string {
  if (isPaperDir(side)) return side.toUpperCase();
  return "NO SIDE";
}

export function displayPnlUsdt(run: PaperRunRow): number | null {
  if (leveragedPaper(run)) {
    const last = Number(run.last_price ?? run.entry_price);
    const exposure = Number(
      run.exposure_usdt ?? paperExposure(Number(run.margin_usdt ?? 0), Number(run.leverage ?? 1)),
    );
    const computed = paperPnlUsdt({
      side: run.side,
      entry: Number(run.entry_price),
      last,
      exposure,
    });
    const stored = run.pnl_usdt;
    if (stored == null || (stored === 0 && computed != null && Math.abs(computed) > 1e-9)) {
      return computed;
    }
    return Number(stored);
  }
  if (run.pnl_usdt == null) return null;
  return Number(run.pnl_usdt);
}

export function stressRowLabel(row: {
  adversePct: number;
  last: number;
  returnOnMarginPct: number | null;
  wouldLiquidate: boolean;
}): string {
  const mark = row.wouldLiquidate ? "LIQ" : "ok";
  return `${row.adversePct}% adverse move → last ${fmtNum(row.last)} \u00b7 ${fmtPct(row.returnOnMarginPct)} \u00b7 ${mark}`;
}

function fmtUsdt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  const sign = n < 0 ? "\u2212" : "";
  return `${sign}${fmtNum(Math.abs(n), 2)} USDT`;
}

export function paperCard(run: PaperRunRow): string {
  const inv = run.invalidation?.price ?? run.thesis?.invalidation_price ?? null;
  const rules = run.invalidation?.rules ?? run.thesis?.i_am_wrong_if ?? [];
  const closed = run.status !== "open";
  const title = closed ? `PAPER RECORD // ${esc(run.symbol)}` : `PAPER // ${esc(run.symbol)}`;
  const thesisLine = run.thesis?.strategy || run.thesis?.reason || "";
  const lev = Number(run.leverage ?? 0);
  const margin = Number(run.margin_usdt ?? 0);
  const last = Number(run.last_price ?? run.entry_price);
  const rawLiq = run.liquidation_price ?? run.liq_price;
  const liq = rawLiq != null && Number.isFinite(Number(rawLiq)) ? Number(rawLiq) : null;
  const dist = leveragedPaper(run) ? distanceToLiquidationPct({ side: run.side, last, liq }) : null;
  const risk = leveragedPaper(run) ? paperRiskState(dist, run.status === "liquidated") : null;
  const riskLine = risk ? `Risk       ${esc(risk.toUpperCase())} \u00b7 ${dist === null ? "n/a" : dist.toFixed(2) + "% to LP"}` : "";
  const usdt = displayPnlUsdt(run);
  return [
    `<b>${title}</b> \u00b7 ${esc(run.status.toUpperCase())}`,
    `Side       <b>${esc(sideLabel(run.side))}</b>`,
    leveragedPaper(run) ? `Leverage   ${fmtNum(lev, 2)}x \u00b7 margin ${fmtUsdt(margin)}` : "",
    leveragedPaper(run) ? `Exposure   ${fmtUsdt(Number(run.exposure_usdt ?? 0))}` : "",
    `Entry      ${fmtNum(Number(run.entry_price))}`,
    `${closed ? "Exit/Last" : "Now     "}  ${fmtNum(last)}`,
    `P&L        <b>${fmtPct(run.pnl_pct)}</b>${usdt != null ? ` \u00b7 ${fmtUsdt(usdt)}` : ""}`,
    liq != null ? `Est. liq (sim)  ${fmtNum(liq)}` : "",
    riskLine,
    `Invalidation ${fmtNum(inv)}`,
    run.opened_at ? `Opened     ${esc(fmtUtc(run.opened_at))}` : "",
    run.closed_at ? `Closed     ${esc(fmtUtc(run.closed_at))}` : "",
    "",
    thesisLine ? `<b>THESIS</b>\n${esc(thesisLine)}` : "",
    rules.length ? `<b>INVALIDATION</b>\n${rules.map((r) => `\u2022 ${esc(r)}`).join("\n")}` : "",
    run.close_reason ? `<b>CLOSE REASON</b>\n${esc(run.close_reason)}` : "",
    "",
    `<i>${PAPER_DISCLAIMER}</i>`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function paperListText(
  openRows: PaperRunRow[],
  wallet?: { paperBalance: number; available: number; inPositions: number },
): string {
  const rows = openRows.filter((r) => r.status === "open");
  const n = rows.length;
  const walletLines = wallet
    ? [
        `Paper balance  ${fmtUsdt(wallet.paperBalance)}`,
        `Available     ${fmtUsdt(wallet.available)}`,
        `In positions  ${fmtUsdt(wallet.inPositions)}`,
        "",
      ]
    : [];
  if (!n) {
    return ["<b>MY PAPER</b>", "", ...walletLines, "No open paper calls.", "", "CALL LIVE from a thesis to start one."].join(
      "\n",
    );
  }
  const body = rows
    .map((r, i) => {
      const side = isPaperDir(r.side) ? r.side.toUpperCase() : "NO SIDE";
      const lev = Number(r.leverage ?? 0);
      const levBit = lev >= 1 ? ` ${fmtNum(lev, 2)}x` : "";
      return [`${i + 1}. <b>${r.symbol}</b> \u00b7 ${side}${levBit}`, `   ${fmtPct(r.pnl_pct)}`, `   Entry ${fmtNum(Number(r.entry_price))}`].join(
        "\n",
      );
    })
    .join("\n\n");
  return [`<b>MY PAPER</b>`, "", ...walletLines, `OPEN \u00b7 ${n}/${MAX_OPEN_PAPER}`, "", body].join("\n");
}

export function recordsListText(closedRows: PaperRunRow[]): string {
  const rows = closedRows.filter((r) => r.status !== "open");
  const stats = recordsStats(rows);
  if (!rows.length) {
    return [
      "<b>RECORDS</b>",
      "",
      "No closed paper calls yet.",
      "",
      "Stopped, invalidated, and liquidated calls land here.",
    ].join("\n");
  }
  const recent = rows.slice(0, 8).map((r) => {
    const side = isPaperDir(r.side) ? r.side.toUpperCase() : "NO SIDE";
    const pnl = Number(r.pnl_pct);
    const mark =
      r.status === "liquidated" ? "\u2620" : !isPaperDir(r.side) || !Number.isFinite(pnl) ? "\u00b7" : pnl > 0 ? "\u2713" : "\u2715";
    return `${mark} <b>${r.symbol}</b> \u00b7 ${side} \u00b7 ${esc(r.status)}\n  ${fmtPct(r.pnl_pct)}`;
  });
  const avgLines: string[] = [];
  if (stats.avgWinner !== null) avgLines.push(`Avg winner   ${fmtPct(stats.avgWinner)}`);
  if (stats.avgLoser !== null) avgLines.push(`Avg loser    ${fmtPct(stats.avgLoser)}`);
  return [
    "<b>RECORDS</b>",
    "",
    `${stats.closed} total closed calls`,
    `${stats.wins} wins \u00b7 ${stats.losses} losses \u00b7 ${stats.liquidated} liquidated`,
    ...avgLines,
    "",
    "<b>RECENT</b>",
    "",
    recent.join("\n\n"),
  ].join("\n");
}

export function walletText(view: {
  paperBalance: number;
  available: number;
  inPositions: number;
  canClaimInitial: boolean;
  canClaimDaily: boolean;
}): string {
  const claim = view.canClaimInitial
    ? `Initial claim available: ${fmtUsdt(PAPER_INITIAL_USDT)}`
    : view.canClaimDaily
      ? `Daily claim available: ${fmtUsdt(PAPER_DAILY_USDT)}`
      : "No claim available until next UTC midnight.";
  return [
    "<b>PAPER WALLET</b>",
    "",
    `Paper balance  ${fmtUsdt(view.paperBalance)}`,
    `Available     ${fmtUsdt(view.available)}`,
    `In positions  ${fmtUsdt(view.inPositions)}`,
    "",
    claim,
    "",
    "<i>Fictional Paper USDT. Claims are explicit. No Bitget deposit.</i>",
  ].join("\n");
}

export function paperLimitText(): string {
  return [
    "<b>PAPER LIMIT REACHED</b>",
    "",
    `You already have ${MAX_OPEN_PAPER} open paper calls.`,
    "",
    "Stop an existing call before opening another.",
  ].join("\n");
}

export function noBiasText(symbol: string): string {
  return [
    "<b>ROOK HAS NO DIRECTIONAL BIAS</b>",
    "",
    `Thesis on <b>${esc(symbol)}</b> is NONE.`,
    "",
    "Make the call yourself.",
    "",
    "LONG or SHORT?",
  ].join("\n");
}

export function marginPromptText(symbol: string, available: number): string {
  return [
    "<b>PAPER MARGIN</b>",
    "",
    `Choose how much Paper USDT to put on <b>${esc(symbol)}</b>.`,
    `Available: ${fmtUsdt(available)} \u00b7 Minimum: ${fmtUsdt(PAPER_MIN_MARGIN)}`,
    "",
    "This margin is reserved on the position. Exposure = margin \u00d7 leverage.",
  ].join("\n");
}

export function leveragePromptText(symbol: string, margin: number): string {
  return [
    "<b>PAPER LEVERAGE</b>",
    "",
    `${esc(symbol)} \u00b7 isolated margin ${fmtUsdt(margin)}`,
    "",
    "1 / 2 / 3 / 5 / 10. Isolated paper risk \u2014 estimated liquidation, not a Bitget engine copy.",
  ].join("\n");
}
