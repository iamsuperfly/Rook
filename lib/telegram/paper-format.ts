import { MAX_OPEN_PAPER, isPaperDir, recordsStats } from "@/lib/desk/paper";
import type { PaperRunRow } from "@/lib/types";
import { esc, fmtNum, fmtPct } from "./format";

function sideLabel(side: string): string {
  if (isPaperDir(side)) return side.toUpperCase();
  return "NO SIDE";
}

export function paperCard(run: PaperRunRow): string {
  const inv = run.invalidation?.price ?? run.thesis?.invalidation_price ?? null;
  const rules = run.invalidation?.rules ?? run.thesis?.i_am_wrong_if ?? [];
  const closed = run.status !== "open";
  const title = closed ? `PAPER RECORD // ${esc(run.symbol)}` : `PAPER // ${esc(run.symbol)}`;
  const thesisLine = run.thesis?.strategy || run.thesis?.reason || "";
  return [
    `<b>${title}</b> · ${esc(run.status.toUpperCase())}`,
    `Side       <b>${esc(sideLabel(run.side))}</b>`,
    `Entry      ${fmtNum(Number(run.entry_price))}`,
    `${closed ? "Exit/Last" : "Now     "}  ${fmtNum(Number(run.last_price))}`,
    `P&amp;L        <b>${fmtPct(run.pnl_pct)}</b>`,
    `Invalidation ${fmtNum(inv)}`,
    run.opened_at ? `Opened     ${esc(run.opened_at)}` : "",
    run.closed_at ? `Closed     ${esc(run.closed_at)}` : "",
    "",
    thesisLine ? `<b>THESIS</b>\n${esc(thesisLine)}` : "",
    rules.length ? `<b>INVALIDATION</b>\n${rules.map((r) => `• ${esc(r)}`).join("\n")}` : "",
    run.close_reason ? `<b>CLOSE REASON</b>\n${esc(run.close_reason)}` : "",
    "",
    "<i>Paper simulation. No Bitget order was sent.</i>",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function paperListText(openRows: PaperRunRow[]): string {
  const rows = openRows.filter((r) => r.status === "open");
  const n = rows.length;
  if (!n) {
    return ["<b>MY PAPER</b>", "", "No open paper calls.", "", "CALL LIVE from a thesis to start one."].join("\n");
  }
  const body = rows
    .map((r, i) => {
      const side = isPaperDir(r.side) ? r.side.toUpperCase() : "NO SIDE";
      return [`${i + 1}. <b>${r.symbol}</b> · ${side}`, `   ${fmtPct(r.pnl_pct)}`, `   Entry ${fmtNum(Number(r.entry_price))}`].join("\n");
    })
    .join("\n\n");
  return `<b>MY PAPER</b>\n\nOPEN · ${n}/${MAX_OPEN_PAPER}\n\n${body}`;
}

export function recordsListText(closedRows: PaperRunRow[]): string {
  const rows = closedRows.filter((r) => r.status !== "open");
  const stats = recordsStats(rows);
  if (!rows.length) {
    return ["<b>RECORDS</b>", "", "No closed paper calls yet.", "", "Stopped and invalidated calls land here."].join("\n");
  }
  const recent = rows.slice(0, 8).map((r) => {
    const side = isPaperDir(r.side) ? r.side.toUpperCase() : "NO SIDE";
    const pnl = Number(r.pnl_pct);
    const mark = !isPaperDir(r.side) || !Number.isFinite(pnl) ? "·" : pnl > 0 ? "✓" : "✕";
    return `${mark} <b>${r.symbol}</b> · ${side}\n  ${fmtPct(r.pnl_pct)}`;
  });
  const avgLines: string[] = [];
  if (stats.avgWinner !== null) avgLines.push(`Avg winner   ${fmtPct(stats.avgWinner)}`);
  if (stats.avgLoser !== null) avgLines.push(`Avg loser    ${fmtPct(stats.avgLoser)}`);
  return [
    "<b>RECORDS</b>",
    "",
    `${stats.closed} total closed calls`,
    `${stats.wins} wins · ${stats.losses} losses`,
    ...avgLines,
    "",
    "<b>RECENT</b>",
    "",
    recent.join("\n\n"),
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
    `Thesis on <b>${symbol}</b> is NONE.`,
    "",
    "Make the call yourself.",
    "",
    "LONG or SHORT?",
  ].join("\n");
}
