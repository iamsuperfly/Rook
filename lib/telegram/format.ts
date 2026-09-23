import { DISCLAIMER, type JudgeReport, type MarketSnapshot, type WatchRow } from "@/lib/types";
import { distancePct } from "@/lib/bitget/scout";

export function esc(s: string): string {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

function bullets(items: string[], empty = "\u2014"): string {
  if (!items.length) return empty;
  return items.map((x) => `• ${esc(x)}`).join("\n");
}

export function fmtNum(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toFixed(digits).replace(/\.?0+$/, "") || "0";
}

export function fmtUtc(iso: string | null | undefined): string {
  if (!iso) return "n/a";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${hh}:${mm} UTC`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function footer(): string {
  return `\n\n<i>${esc(DISCLAIMER)}</i>`;
}

export function welcomeText(): string {
  return [
    "<b>ROOK</b> \u2014 adversarial desk for Bitget tokenized US names / USDT markets.",
    "",
    "I build a thesis, attack it, write explicit invalidation, then watch after hours.",
    "I <b>never</b> place an order. You call it off.",
    "",
    "Use the keyboard. Slash commands only redraw it.",
    footer(),
  ].join("\n");
}

export function helpText(): string {
  return [
    "<b>HOW ROOK WORKS</b>",
    "1. NEW THESIS \u2192 horizon \u2192 side \u2192 market",
    "2. Scout pulls live Bitget public numbers (no LLM prices)",
    "3. Bull and Bear argue. Judge writes the thesis and a hard invalidation price",
    "4. WATCH THIS monitors the thesis. CALL LIVE opens a directional paper call",
    "5. MY PAPER is open calls (max 10). RECORDS is stopped and invalidated calls",
    "6. If the invalidation price is crossed I tell you. I never place a Bitget order",
    "",
    "<b>Bitget AI Base Camp S2</b> \u2014 track: AI Trading Desk (research workbench / decision stress testing). No execution.",
    "",
    "Bare tickers like NVDA map to NVDAUSDT, then RNVDAUSDT (Bitget rToken style) if needed.",
    footer(),
  ].join("\n");
}

export function snapshotLine(s: MarketSnapshot): string {
  return [
    `<b>${esc(s.symbol)}</b> last <b>${fmtNum(s.last)}</b>  24h ${fmtPct(s.change24hPct)}`,
    `bid/ask ${fmtNum(s.bid)} / ${fmtNum(s.ask)}  hi/lo ${fmtNum(s.high24h)} / ${fmtNum(s.low24h)}`,
    `vol24h ${fmtNum(s.volumeQuote, 0)} USDT  rvol ${fmtPct(s.realizedVol24hPct)}  SMA20 ${fmtNum(s.sma20)}`,
    `<i>source ${esc(s.source)}</i>`,
  ].join("\n");
}

export function thesisCard(report: JudgeReport, snapshot?: MarketSnapshot, prevConf?: number | null): string {
  const conf =
    prevConf !== null && prevConf !== undefined && prevConf !== report.confidence
      ? `${prevConf} \u2192 ${report.confidence}`
      : String(report.confidence);
  const lines = [
    `<b>ROOK REPORT // ${esc(report.symbol)}</b>`,
    `${esc(report.horizon)} \u00b7 bias <b>${esc(report.bias.toUpperCase())}</b> \u00b7 confidence <b>${esc(conf)}</b> \u00b7 evidence ${report.evidence_quality}`,
    `action <b>${esc(report.action)}</b>`,
    snapshot ? snapshotLine(snapshot) : "",
    "",
    `<b>STRATEGY</b>`,
    esc(report.strategy || report.reason || "\u2014"),
    "",
    `<b>INVALIDATION</b> ${fmtNum(report.invalidation_price)}`,
    esc(report.invalidation_note || "\u2014"),
    "",
    `<b>WHY</b>`,
    esc(report.reason || "\u2014"),
  ];
  if (report.parse_error && report.raw_text) {
    lines.push("", "<b>UNPARSED JUDGE TEXT</b>", `<pre>${esc(report.raw_text.slice(0, 1500))}</pre>`);
  }
  lines.push(footer());
  return lines.filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
}

export function sectionCard(title: string, body: string): string {
  return `<b>${esc(title)}</b>\n${esc(body || "\u2014")}${footer()}`;
}

export function wrongCard(report: JudgeReport): string {
  return [
    `<b>I AM WRONG IF \u2014 ${esc(report.symbol)}</b>`,
    bullets(report.i_am_wrong_if),
    "",
    `<b>RISKS</b>`,
    bullets(report.risks),
    "",
    `<b>CATALYSTS</b>`,
    bullets(report.catalysts),
    "",
    `Invalidation price: <b>${fmtNum(report.invalidation_price)}</b>`,
    esc(report.invalidation_note || ""),
    footer(),
  ].join("\n");
}

export function watchesText(rows: WatchRow[]): string {
  if (!rows.length) return `No active watches.\nTap NEW THESIS.${footer()}`;
  const body = rows
    .map((w, i) => {
      const inv = w.invalidation?.price ?? w.last_thesis?.invalidation_price ?? null;
      const dist = distancePct(Number(w.last_price ?? 0), inv);
      return [
        `<b>${i + 1}. ${esc(w.symbol)}</b> ${esc(w.horizon)} ${esc(String(w.side))}`,
        `confidence ${w.last_confidence ?? "?"} \u00b7 action ${esc(w.last_action ?? "?")} \u00b7 last ${fmtNum(Number(w.last_price))}`,
        `invalidation ${fmtNum(inv)} \u00b7 dist ${fmtPct(dist)}`,
      ].join("\n");
    })
    .join("\n\n");
  return `<b>ACTIVE WATCHES</b>\n\n${body}${footer()}`;
}

export function settingsText(alertsOn: boolean, every: string): string {
  return [
    "<b>SETTINGS</b>",
    `Alerts: <b>${alertsOn ? "ON" : "OFF"}</b>`,
    `Preferred check cadence: <b>${esc(every)}</b>`,
    "This is your preference for how often Rook should re-read open watches.",
    footer(),
  ].join("\n");
}

export function alertText(opts: {
  symbol: string;
  prevConf: number | null;
  nextConf: number;
  action: string;
  last: number;
  inv: number | null;
  reason: string;
}): string {
  const conf =
    opts.prevConf !== null && opts.prevConf !== opts.nextConf
      ? `${opts.prevConf} \u2192 ${opts.nextConf}`
      : String(opts.nextConf);
  return [
    `<b>WATCH ALERT // ${esc(opts.symbol)}</b>`,
    `action <b>${esc(opts.action)}</b> \u00b7 confidence <b>${esc(conf)}</b>`,
    `last ${fmtNum(opts.last)} \u00b7 invalidation ${fmtNum(opts.inv)}`,
    esc(opts.reason),
    footer(),
  ].join("\n");
}
