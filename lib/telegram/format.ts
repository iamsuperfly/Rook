import { DISCLAIMER, type JudgeReport, type MarketSnapshot, type WatchRow } from "@/lib/types";
import { distancePct } from "@/lib/bitget/scout";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function heading(title: string): string {
  return `<b>${esc(title)}</b>`;
}

export function instrument(symbol: string): string {
  return `<code>${esc(symbol)}</code>`;
}

export function emphasis(value: string | number): string {
  return `<b>${esc(String(value))}</b>`;
}

export function price(n: number | null | undefined, digits = 4): string {
  return emphasis(fmtNum(n, digits));
}

export function metadata(text: string): string {
  return `<i>${esc(text)}</i>`;
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

export function invRelationLabel(last: number, inv: number | null | undefined): string {
  if (inv == null || !Number.isFinite(inv) || !Number.isFinite(last) || last === 0) return "n/a";
  const d = distancePct(last, inv);
  if (d == null) return "n/a";
  if (Math.abs(d) < 0.005) return "at invalidation";
  const abs = Math.abs(d).toFixed(2);
  return last > inv ? `${abs}% above invalidation` : `${abs}% below invalidation`;
}

export function footer(): string {
  return `\n\n${metadata(DISCLAIMER)}`;
}

export function welcomeText(): string {
  return [
    `${heading("ROOK")} — adversarial desk for Bitget tokenized US names / USDT markets.`,
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
    heading("HOW ROOK WORKS"),
    "1. NEW THESIS → horizon → side → market",
    "2. Scout pulls live Bitget public numbers (no LLM prices)",
    "3. Bull and Bear argue. Judge writes the thesis and a hard invalidation price",
    "4. WATCH THIS monitors the thesis. CALL LIVE opens a directional paper call",
    "5. MY PAPER is open calls (max 10). RECORDS is stopped, invalidated, and liquidated calls",
    "6. Open watches are checked every 15 minutes. If the stored invalidation price is crossed I tell you. I never place a Bitget order",
    "",
    `${heading("Bitget AI Base Camp S2")} — track: AI Trading Desk (research workbench / decision stress testing). No execution.`,
    "",
    "Bare tickers like NVDA map to NVDAUSDT, then RNVDAUSDT (Bitget rToken style) if needed.",
    footer(),
  ].join("\n");
}

export function snapshotLine(s: MarketSnapshot): string {
  return [
    `${instrument(s.symbol)} ${price(s.last)} · 24h ${fmtPct(s.change24hPct)}`,
    `Bid/ask ${fmtNum(s.bid)} / ${fmtNum(s.ask)}`,
    `High/low ${fmtNum(s.high24h)} / ${fmtNum(s.low24h)}`,
    `Vol ${fmtNum(s.volumeQuote, 0)} USDT · RVOL ${fmtPct(s.realizedVol24hPct)}`,
    `SMA20 ${fmtNum(s.sma20)}`,
    metadata(`source ${s.source}`),
  ].join("\n");
}

export function thesisCard(report: JudgeReport, snapshot?: MarketSnapshot, prevConf?: number | null): string {
  const conf =
    prevConf !== null && prevConf !== undefined && prevConf !== report.confidence
      ? `${prevConf} → ${report.confidence}`
      : String(report.confidence);
  const last = snapshot?.last ?? null;
  const invRel = last != null ? invRelationLabel(Number(last), report.invalidation_price) : "";
  const lines = [
    heading("ROOK REPORT"),
    `${instrument(report.symbol)} · ${esc(report.horizon)}`,
    "",
    `Bias ${emphasis(report.bias.toUpperCase())}`,
    `Confidence ${emphasis(conf)} · Evidence ${emphasis(report.evidence_quality)}`,
    `Action ${emphasis(report.action.toUpperCase())}`,
    snapshot ? snapshotLine(snapshot) : "",
    "",
    heading("STRATEGY"),
    esc(report.strategy || report.reason || "—"),
    "",
    heading("INVALIDATION"),
    `${price(report.invalidation_price)}${invRel && invRel !== "n/a" ? ` · ${esc(invRel)}` : ""}`,
    esc(report.invalidation_note || "—"),
    "",
    heading("WHY"),
    esc(report.reason || "—"),
  ];
  if (report.parse_error && report.raw_text) {
    lines.push("", heading("UNPARSED JUDGE TEXT"), `<pre>${esc(report.raw_text.slice(0, 1500))}</pre>`);
  }
  lines.push(footer());
  return lines.filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
}

export function sectionCard(title: string, body: string): string {
  return `${heading(title)}\n${esc(body || "—")}${footer()}`;
}

export function wrongCard(report: JudgeReport): string {
  return [
    `${heading("I AM WRONG IF")} — ${instrument(report.symbol)}`,
    `Deterministic close ${price(report.invalidation_price)}`,
    esc(report.invalidation_note || ""),
    "",
    heading("WARNING SIGNS"),
    bullets(report.i_am_wrong_if),
    "",
    heading("RISKS"),
    bullets(report.risks),
    "",
    heading("CATALYSTS"),
    bullets(report.catalysts),
    footer(),
  ].join("\n");
}

export function watchesText(rows: WatchRow[]): string {
  if (!rows.length) return `No active watches.\nTap NEW THESIS.${footer()}`;
  const body = rows
    .map((w, i) => {
      const inv = w.invalidation?.price ?? w.last_thesis?.invalidation_price ?? null;
      const last = Number(w.last_price ?? 0);
      return [
        `${i + 1}. ${instrument(w.symbol)} · ${esc(w.horizon)} · ${esc(String(w.side))}`,
        `Confidence ${w.last_confidence ?? "?"} · Action ${esc(w.last_action ?? "?")} · Last ${fmtNum(last)}`,
        `Invalidation ${fmtNum(inv)} · ${invRelationLabel(last, inv)}`,
      ].join("\n");
    })
    .join("\n\n");
  return `${heading("ACTIVE WATCHES")}\n\n${body}${footer()}`;
}

export function settingsText(alertsOn: boolean): string {
  return [
    heading("SETTINGS"),
    `Alerts: ${emphasis(alertsOn ? "ON" : "OFF")}`,
    "Open watches and paper calls are checked automatically every 15 minutes.",
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
      ? `${opts.prevConf} → ${opts.nextConf}`
      : String(opts.nextConf);
  return [
    `${heading("WATCH ALERT")} — ${instrument(opts.symbol)}`,
    `Action ${emphasis(opts.action.toUpperCase())} · Confidence ${emphasis(conf)}`,
    `Last ${fmtNum(opts.last)} · Invalidation ${fmtNum(opts.inv)} · ${invRelationLabel(opts.last, opts.inv)}`,
    esc(opts.reason),
    footer(),
  ].join("\n");
}
