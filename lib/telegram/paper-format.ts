import type { PaperRunRow } from "@/lib/types";
import { DISCLAIMER } from "@/lib/types";
import { fmtNum, fmtPct } from "./format";

export function paperCard(run: PaperRunRow): string {
  const inv = run.invalidation?.price ?? run.thesis?.invalidation_price ?? null;
  const rules = run.invalidation?.rules ?? run.thesis?.i_am_wrong_if ?? [];
  return [
    `<b>PAPER // ${run.symbol}</b> · ${run.status.toUpperCase()}`,
    `${run.horizon} · side <b>${run.side}</b>`,
    `entry ${fmtNum(Number(run.entry_price))} · now ${fmtNum(Number(run.last_price))} · pnl <b>${fmtPct(run.pnl_pct)}</b>`,
    `invalidation ${fmtNum(inv)}`,
    rules.length ? rules.map((r) => `• ${r}`).join("\n") : "—",
    run.close_reason ? `close: ${run.close_reason}` : "",
    "",
    "<i>Paper only. No Bitget order was sent.</i>",
    `<i>${DISCLAIMER}</i>`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function paperListText(rows: PaperRunRow[]): string {
  if (!rows.length) return `No paper runs.\nCALL LIVE on a thesis to freeze a snapshot.\n\n<i>${DISCLAIMER}</i>`;
  const body = rows
    .map((r, i) => `${i + 1}. <b>${r.symbol}</b> ${r.status} · pnl ${fmtPct(r.pnl_pct)} · entry ${fmtNum(Number(r.entry_price))}`)
    .join("\n");
  return `<b>MY PAPER</b>\n${body}\n\n<i>${DISCLAIMER}</i>`;
}
