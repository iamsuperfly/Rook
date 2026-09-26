import { crossedInvalidation } from "@/lib/bitget/scout";
import type { WatchRow } from "@/lib/types";
import { crossedConfirmation, storedConfirmationPrice } from "./confirmation";
import { isPaperDir } from "./paper";

export function storedInvalidationPrice(watch: WatchRow): number | null {
  const fromBlob = watch.invalidation?.price;
  if (fromBlob !== null && fromBlob !== undefined && Number.isFinite(Number(fromBlob))) {
    return Number(fromBlob);
  }
  const fromThesis = watch.last_thesis?.invalidation_price;
  if (fromThesis !== null && fromThesis !== undefined && Number.isFinite(Number(fromThesis))) {
    return Number(fromThesis);
  }
  return null;
}

export function watchDirection(watch: WatchRow): "long" | "short" | null {
  if (isPaperDir(watch.side)) return watch.side;
  const bias = watch.last_thesis?.bias;
  if (bias === "long" || bias === "short") return bias;
  return null;
}

export function watchCrossed(watch: WatchRow, last: number): boolean {
  const dir = watchDirection(watch);
  if (!dir) return false;
  return crossedInvalidation(dir, last, storedInvalidationPrice(watch));
}

export function watchConfirmationCrossed(watch: WatchRow, last: number): boolean {
  const dir = watchDirection(watch);
  if (!dir) return false;
  return crossedConfirmation(dir, last, storedConfirmationPrice(watch));
}

/** Alert must show the inv that was evaluated — never mix stored vs rewritten. */
export function alertInvalidationPrice(opts: {
  crossed: boolean;
  storedInv: number | null;
  rewrittenInv?: number | null;
}): number | null {
  if (opts.crossed) return opts.storedInv;
  const next = opts.rewrittenInv;
  if (next !== null && next !== undefined && Number.isFinite(Number(next))) return Number(next);
  return opts.storedInv;
}
