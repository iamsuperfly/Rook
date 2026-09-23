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
import { emphasis, esc, fmtNum, fmtPct, fmtUtc, heading, instrument, invRelationLabel, metadata, price } from "./format";

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
  pnlUsdt?: number | null;
  wouldLiquidate: boolean;
}): string {
  const mark = row.wouldLiquidate ? "LIQ" : "OK";
  const usdt =
    row.pnlUsdt == null || !Number.isFinite(row.pnlUsdt) ? "" : ` \u00b7 ${fmtUsdt(row.pnlUsdt)}`;
  return `${row.adversePct}% adverse move \u2192 last ${fmtNum(row.last)} \u00b7 ${fmtPct(row.returnOnMarginPct)}${usdt} \u00b7 ${mark}`;
}

function fmtUsdt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  const sign = n < 0 ? "\u2212" : "";
  return `${sign}${fmtNum(Math.abs(n), 2)} USDT`;
}

export function addMarginResultText(opts: {
  beforeMargin: number;
  afterMargin: number;
  exposure: number;
  beforeLeverage: number;
  afterLeverage: number;
}): string {
  return [
    heading("MARGIN ADDED"),
    `Margin ${fmtNum(opts.beforeMargin, 2)} \u2192 ${emphasis(fmtUsdt(opts.afterMargin))}`,
    `Exposure remains ${fmtUsdt(opts.exposure)}`,
    `Effective leverage ${fmtNum(opts.beforeLeverage, 2)}x \u2192 ${emphasis(`${fmtNum(opts.afterLeverage, 2)}x`)}`,
    "Estimated liquidation moved farther from last.",
    "",
    metadata(PAPER_DISCLAIMER),
  ].join("\n");
}

export function paperCard(run: PaperRunRow): string {
  const inv = run.invalidation?.price ?? run.thesis?.invalidation_price ?? null;
  const note = run.invalidation?.note ?? run.thesis?.invalidation_note ?? "";
  const rules = run.invalidation?.rules ?? run.thesis?.i_am_wrong_if ?? [];
  const closed = run.status !== "open";
  const thesisLine = run.thesis?.strategy || run.thesis?.reason || "";
  const lev = Number(run.leverage ?? 0);
  const margin = Number(run.margin_usdt ?? 0);
  const last = Number(run.last_price ?? run.entry_price);
  const rawLiq = run.liquidation_price ?? run.liq_price;
  const liq = rawLiq != null && Number.isFinite(Number(rawLiq)) ? Number(rawLiq) : null;
  const dist = leveragedPaper(run) ? distanceToLiquidationPct({ side: run.side, last, liq }) : null;
  const risk = leveragedPaper(run) ? paperRiskState(dist, run.status === "liquidated") : null;
  const riskLine = risk
    ? `Risk ${emphasis(risk.toUpperCase())}${
        dist == null ? "" : ` \u00b7 ${dist.toFixed(2)}% to estimated liquidation`
      }`
    : "";
  const usdt = displayPnlUsdt(run);
  const title = closed ? "PAPER RECORD" : "PAPER";
  return [
    `${heading(title)} \u00b7 ${instrument(run.symbol)} \u00b7 ${emphasis(run.status.toUpperCase())}`,
    `Side ${emphasis(sideLabel(run.side))}`,
    leveragedPaper(run)
      ? `Leverage ${emphasis(`${fmtNum(lev, 2)}x`)} \u00b7 Margin ${emphasis(fmtUsdt(margin))}`
      : "",
    leveragedPaper(run) ? `Exposure ${emphasis(fmtUsdt(Number(run.exposure_usdt ?? 0)))}` : "",
    `Entry ${price(Number(run.entry_price))}`,
    `${closed ? "Exit/Last" : "Now"} ${price(last)}`,
    `P&L ${emphasis(fmtPct(run.pnl_pct))}${usdt != null ? ` \u00b7 ${fmtUsdt(usdt)}` : ""}`,
    liq != null ? `Estimated liquidation (sim) ${price(liq)}` : "",
    riskLine,
    `Invalidation ${price(inv)}${
      Number.isFinite(last) && inv != null ? ` \u00b7 ${esc(invRelationLabel(last, inv))}` : ""
    }`,
    note ? esc(note) : "",
    run.opened_at ? metadata(`Opened ${fmtUtc(run.opened_at)}`) : "",
    run.closed_at ? metadata(`Closed ${fmtUtc(run.closed_at)}`) : "",
    "",
    thesisLine ? `${heading("THESIS")}\n${esc(thesisLine)}` : "",
    rules.length ? `${heading("WARNING SIGNS")}\n${rules.map((r) => `\u2022 ${esc(r)}`).join("\n")}` : "",
    run.close_reason ? `${heading("CLOSE REASON")}\n${esc(run.close_reason)}` : "",
    "",
    metadata(PAPER_DISCLAIMER),
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
        `Balance ${emphasis(fmtUsdt(wallet.paperBalance))}`,
        `Available ${emphasis(fmtUsdt(wallet.available))}`,
        `In positions ${emphasis(fmtUsdt(wallet.inPositions))}`,
        "",
      ]
    : [];
  if (!n) {
    return [heading("MY PAPER"), "", ...walletLines, "No open paper calls.", "", "CALL LIVE from a thesis to start one."].join(
      "\n",
    );
  }
  const body = rows
    .map((r, i) => {
      const side = isPaperDir(r.side) ? r.side.toUpperCase() : "NO SIDE";
      const lev = Number(r.leverage ?? 0);
      const levBit = lev >= 1 ? ` \u00b7 ${fmtNum(lev, 2)}x` : "";
      return [
        `${i + 1}. ${instrument(r.symbol)} \u00b7 ${esc(side)}${levBit}`,
        `P&L ${fmtPct(r.pnl_pct)} \u00b7 Entry ${fmtNum(Number(r.entry_price))}`,
      ].join("\n");
    })
    .join("\n\n");
  return [heading("MY PAPER"), "", ...walletLines, `Open ${emphasis(`${n}/${MAX_OPEN_PAPER}`)}`, "", body].join("\n");
}

export function recordsListText(closedRows: PaperRunRow[]): string {
  const rows = closedRows.filter((r) => r.status !== "open");
  const stats = recordsStats(rows);
  if (!rows.length) {
    return [
      heading("RECORDS"),
      "",
      "No closed paper calls yet.",
      "",
      "Stopped, invalidated, and liquidated calls land here.",
    ].join("\n");
  }
  const recent = rows.slice(0, 8).map((r) => {
    const side = isPaperDir(r.side) ? r.side.toUpperCase() : "NO SIDE";
    const usdt = displayPnlUsdt(r);
    return [
      `${instrument(r.symbol)} \u00b7 ${esc(side)} \u00b7 ${emphasis(r.status.toUpperCase())}`,
      `P&L ${emphasis(fmtPct(r.pnl_pct))}${usdt != null ? ` \u00b7 ${fmtUsdt(usdt)}` : ""}`,
      `Entry ${fmtNum(Number(r.entry_price))} \u2192 ${fmtNum(Number(r.last_price ?? r.entry_price))}`,
    ].join("\n");
  });
  const avgLines: string[] = [];
  if (stats.avgWinner !== null) avgLines.push(`Avg winner ${fmtPct(stats.avgWinner)}`);
  if (stats.avgLoser !== null) avgLines.push(`Avg loser ${fmtPct(stats.avgLoser)}`);
  return [
    heading("RECORDS"),
    "",
    `${stats.closed} closed calls`,
    `${stats.wins} wins \u00b7 ${stats.losses} losses \u00b7 ${stats.liquidated} liquidated`,
    ...avgLines,
    "",
    heading("RECENT"),
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
    ? `Initial claim available: ${emphasis(fmtUsdt(PAPER_INITIAL_USDT))}`
    : view.canClaimDaily
      ? `Daily claim available: ${emphasis(fmtUsdt(PAPER_DAILY_USDT))}`
      : "No claim available until next UTC midnight.";
  return [
    heading("PAPER WALLET"),
    "",
    `Balance ${emphasis(fmtUsdt(view.paperBalance))}`,
    `Available ${emphasis(fmtUsdt(view.available))}`,
    `In positions ${emphasis(fmtUsdt(view.inPositions))}`,
    "",
    claim,
    "",
    metadata("Fictional Paper USDT. Claims are explicit. No Bitget deposit."),
  ].join("\n");
}

export function paperLimitText(): string {
  return [
    heading("PAPER LIMIT REACHED"),
    "",
    `You already have ${MAX_OPEN_PAPER} open paper calls.`,
    "",
    "Stop an existing call before opening another.",
  ].join("\n");
}

export function noBiasText(symbol: string): string {
  return [
    heading("ROOK HAS NO DIRECTIONAL BIAS"),
    "",
    `Thesis on ${instrument(symbol)} is NONE.`,
    "",
    "Make the call yourself.",
    "",
    "LONG or SHORT?",
  ].join("\n");
}

export function marginPromptText(symbol: string, available: number): string {
  return [
    heading("PAPER MARGIN"),
    "",
    `Choose how much Paper USDT to put on ${instrument(symbol)}.`,
    `Available: ${fmtUsdt(available)} \u00b7 Minimum: ${fmtUsdt(PAPER_MIN_MARGIN)}`,
    "",
    "This margin is reserved on the position. Exposure = margin \u00d7 leverage.",
  ].join("\n");
}

export function leveragePromptText(symbol: string, margin: number): string {
  return [
    heading("PAPER LEVERAGE"),
    "",
    `${instrument(symbol)} \u00b7 isolated margin ${fmtUsdt(margin)}`,
    "",
    "1 / 2 / 3 / 5 / 10. Isolated paper risk \u2014 estimated liquidation, not a Bitget engine copy.",
  ].join("\n");
}

export function stressText(opts: {
  symbol: string;
  baselineLiq: number | null;
  withExtraLiq: number | null;
  rows: Array<{
    adversePct: number;
    last: number;
    returnOnMarginPct: number | null;
    pnlUsdt?: number | null;
    wouldLiquidate: boolean;
  }>;
}): string {
  return [
    `${heading("STRESS TEST")} \u2014 ${instrument(opts.symbol)}`,
    `Estimated liquidation (sim) ${fmtNum(opts.baselineLiq)}`,
    opts.withExtraLiq != null ? `If you add 50 margin: estimated liquidation ${fmtNum(opts.withExtraLiq)}` : "",
    "",
    ...opts.rows.map(stressRowLabel),
    "",
    metadata("Numbers only. Rook does not add margin or close this call."),
  ]
    .filter((l) => l !== "")
    .join("\n");
}
