import { DISCLAIMER, type JudgeReport, type MarketSnapshot, type WatchRow } from "@/lib/types";
import { distancePct } from "@/lib/bitget/scout";

export function esc(s: string): string {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
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
