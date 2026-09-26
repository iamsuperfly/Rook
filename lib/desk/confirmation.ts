import { crossedInvalidation } from "@/lib/bitget/scout";
import type { ConfirmationBlob, ConfirmationState, JudgeReport, MarketSnapshot } from "@/lib/types";
import { sideFromBias } from "./invalidation";

export type ConfirmationSnapshot = Pick<MarketSnapshot, "last"> & {
  high24h?: number | null;
  low24h?: number | null;
};

export function isValidConfirmationPrice(side: "long" | "short", last: number, price: number): boolean {
  if (!Number.isFinite(last) || last <= 0 || !Number.isFinite(price) || price <= 0) return false;
  if (side === "long") return price > last;
  return price < last;
}

/**
 * Same last-vs-price comparisons as invalidation, on the favorable side:
 * long confirm = short invalidation (last >= price);
 * short confirm = long invalidation (last <= price).
 */
export function crossedConfirmation(
  side: string | null | undefined,
  last: number,
  price: number | null | undefined,
): boolean {
  const s = (side ?? "").toLowerCase();
  if (s === "long") return crossedInvalidation("short", last, price);
  if (s === "short") return crossedInvalidation("long", last, price);
  return false;
}

export function sanitizeConfirmationPrice(opts: {
  side: "long" | "short" | null;
  last: number;
  proposed: number | null | undefined;
}): number | null {
  const proposed = opts.proposed == null ? null : Number(opts.proposed);
  if (proposed == null || !Number.isFinite(proposed) || proposed <= 0) return null;
  if (!opts.side) return null;
  return isValidConfirmationPrice(opts.side, opts.last, proposed) ? proposed : null;
}

export function deterministicConfirmationTrigger(side: "long" | "short" | null, price: number): string {
  if (side === "long") return `Price trades at or above ${price}.`;
  if (side === "short") return `Price trades at or below ${price}.`;
  return `Price trades through ${price}.`;
}

/**
 * Keep a Judge confirmation price only when it is still in the future for this side.
 * Never invent a fallback level. No price → no confirmation.
 */
export function applyConfirmation(
  report: JudgeReport,
  snapshot: ConfirmationSnapshot,
  sideOverride?: "long" | "short" | null,
): JudgeReport {
  const side = sideOverride ?? sideFromBias(report.bias);
  const price = sanitizeConfirmationPrice({
    side,
    last: snapshot.last,
    proposed: report.confirmation_price,
  });
  report.confirmation_price = price;
  if (price == null) {
    report.confirmation_trigger = "";
    report.confirmation_note = "";
    return report;
  }
  report.confirmation_trigger = deterministicConfirmationTrigger(side, price);
  report.confirmation_note = String(report.confirmation_note ?? "").trim();
  return report;
}

export function confirmationBlobFromReport(
  report: JudgeReport,
  prior?: ConfirmationBlob | null,
): ConfirmationBlob | null {
  const price = report.confirmation_price;
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return prior?.price != null && Number.isFinite(prior.price) ? prior : null;
  }
  const state: ConfirmationState = prior?.state === "confirmed" ? "confirmed" : "developing";
  return {
    trigger: report.confirmation_trigger || deterministicConfirmationTrigger(sideFromBias(report.bias), price),
    i_am_right_if: report.confirmation_note || "",
    price,
    state,
    confirmed_at: state === "confirmed" ? prior?.confirmed_at ?? null : null,
  };
}

export function storedConfirmation(source: {
  confirmation?: ConfirmationBlob | null;
  thesis?: JudgeReport | null;
  last_thesis?: JudgeReport | null;
}): ConfirmationBlob | null {
  const blob = source.confirmation;
  if (blob?.price != null && Number.isFinite(blob.price) && blob.price > 0) return blob;
  const report = source.thesis ?? source.last_thesis ?? null;
  if (!report || report.confirmation_price == null || report.confirmation_price === undefined) return null;
  return confirmationBlobFromReport(report);
}

export function storedConfirmationPrice(source: {
  confirmation?: ConfirmationBlob | null;
  thesis?: JudgeReport | null;
  last_thesis?: JudgeReport | null;
}): number | null {
  return storedConfirmation(source)?.price ?? null;
}

export function markConfirmed(blob: ConfirmationBlob, at: Date = new Date()): ConfirmationBlob {
  if (blob.state === "confirmed") return blob;
  return { ...blob, state: "confirmed", confirmed_at: at.toISOString() };
}

export type ThesisHealth = "STILL DEVELOPING" | "CONFIRMED" | "INVALIDATED";

/** Invalidation always wins when both lines are reachable on the same print. */
export function thesisHealth(opts: {
  invalidated: boolean;
  confirmation?: ConfirmationBlob | null;
}): ThesisHealth {
  if (opts.invalidated) return "INVALIDATED";
  if (opts.confirmation?.state === "confirmed") return "CONFIRMED";
  return "STILL DEVELOPING";
}
