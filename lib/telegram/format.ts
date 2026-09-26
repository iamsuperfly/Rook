import { DISCLAIMER, type ConfirmationBlob, type JudgeReport, type MarketSnapshot, type WatchRow } from "@/lib/types";
import { distancePct } from "@/lib/bitget/scout";
import { storedConfirmation } from "@/lib/desk/confirmation";

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
  return items.map((x) => `\u2022 ${esc(x)}`).join("\n");
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

export function levelVsLastLabel(last: number, level: number | null | undefined): string {
  if (level == null || !Number.isFinite(level) || !Number.isFinite(last) || last === 0) return "n/a";
  const d = distancePct(last, level);
  if (d == null) return "n/a";
  if (Math.abs(d) < 0.005) return "at last";
  const abs = Math.abs(d).toFixed(2);
  return last > level ? `${abs}% below last` : `${abs}% above last`;
}

export function invRelationLabel(last: number, inv: number | null | undefined): string {
  const rel = levelVsLastLabel(last, inv);
  if (rel === "n/a") return "n/a";
  if (rel === "at last") return "at invalidation";
  return `invalidation ${rel}`;
}

export function footer(): string {
  return `\n\n${metadata(DISCLAIMER)}`;
}

export function welcomeText(): string {
  return [
    `${heading("ROOK")} — an adversarial trading desk for crypto markets.`,
    "",
    "I build a thesis, attack it, then write the pair that makes the argument honest:",
    "INVALIDATION — I'm wrong if…",
    "CONFIRMATION — I'm right if…",
    "",
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
    "2. Scout pulls live public numbers (no LLM prices)",
    "3. Bull and Bear argue. Judge writes strategy, invalidation, and confirmation",
    "4. WATCH THIS monitors both lines. CALL LIVE opens a directional paper call",
    "5. MY PAPER is open calls (max 10). RECORDS is stopped, invalidated, and liquidated calls",
    "6. Open watches are checked every 15 minutes. Invalidation can call the thesis off. Confirmation does not close a paper call",
    "",
    "INVALIDATION is what proves the argument wrong. CONFIRMATION is what proves it right. Confirmation is not a take-profit.",
    "",
    "Bare tickers like NVDA map to NVDAUSDT, then RNVDAUSDT if needed.",
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

function confirmationBlock(
  report: JudgeReport,
  last: number | null,
  stored?: ConfirmationBlob | null,
): string[] {
  const blob = stored ?? storedConfirmation({ thesis: report });
  const confPrice = blob?.price ?? report.confirmation_price ?? null;
  const trigger = blob?.trigger || report.confirmation_trigger || "";
  const rightIf = blob?.i_am_right_if || report.confirmation_note || "";
  const state = blob?.state ?? "none";
  const rel = last != null ? levelVsLastLabel(Number(last), confPrice) : "";
  const head =
    confPrice != null
      ? `${price(confPrice)}${rel && rel !== "n/a" ? ` · ${esc(rel)}` : ""}`
      : emphasis("No confirmation");
  const stateLine =
    state === "confirmed"
      ? emphasis("CONFIRMED")
      : confPrice != null
        ? metadata("Still developing")
        : "";
  return [
    heading("CONFIRMATION"),
    head,
    stateLine,
    trigger ? `${heading("Trigger")}\n${esc(trigger)}` : "",
    rightIf ? `I'm right if\n${esc(rightIf)}` : "",
  ].filter((l) => l !== "");
}

export function thesisCard(
  report: JudgeReport,
  snapshot?: MarketSnapshot,
  prevConf?: number | null,
  storedConfirmationBlob?: ConfirmationBlob | null,
): string {
  const conf =
    prevConf !== null && prevConf !== undefined && prevConf !== report.confidence
      ? `${prevConf} → ${report.confidence}`
      : String(report.confidence);
  const last = snapshot?.last ?? null;
  const invRel = last != null ? levelVsLastLabel(Number(last), report.invalidation_price) : "";
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
    report.invalidation_price != null ? `${heading("Trigger")}\nPrice trades at the invalidation print.` : "",
    `I'm wrong if\n${esc(report.invalidation_note || "—")}`,
    "",
    ...confirmationBlock(report, last, storedConfirmationBlob),
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
    heading("I AM RIGHT IF"),
    report.confirmation_price != null ? `Confirmation print ${price(report.confirmation_price)}` : emphasis("No confirmation"),
    esc(report.confirmation_note || (report.confirmation_price != null ? report.confirmation_trigger : "") || "No confirmation stored on this thesis."),
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
        w.confirmation?.state === "confirmed"
          ? "Confirmation CONFIRMED"
          : w.confirmation?.price != null
            ? "Confirmation still developing"
            : "",
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

export function confirmationAlertText(opts: { symbol: string; last: number; trigger: string }): string {
  return [
    `${heading("THESIS CONFIRMED")} — ${instrument(opts.symbol)}`,
    `Last ${fmtNum(opts.last)}`,
    opts.trigger ? esc(opts.trigger) : "The stored confirmation trigger printed.",
    metadata("Confirmation is not an exit. The paper call stays open until you stop it or invalidation hits."),
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
