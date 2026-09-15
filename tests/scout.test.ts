import { describe, expect, it } from "vitest";
import {
  crossedInvalidation,
  distancePct,
  moveVsSnapshotPct,
  normalizeSymbol,
  parseNum,
  realizedVolPct,
  sma,
  symbolCandidates,
} from "@/lib/bitget/scout";

describe("normalizeSymbol", () => {
  it("uppercases and appends USDT", () => {
    expect(normalizeSymbol("nvda")).toBe("NVDAUSDT");
    expect(normalizeSymbol("BTCUSDT")).toBe("BTCUSDT");
    expect(normalizeSymbol(" btc-usdt ")).toBe("BTCUSDT");
  });
});

describe("symbolCandidates", () => {
  it("adds rToken form for US names", () => {
    expect(symbolCandidates("NVDA")).toEqual(["NVDAUSDT", "RNVDAUSDT"]);
    expect(symbolCandidates("RNVDAUSDT")).toEqual(["RNVDAUSDT"]);
  });
});

describe("scout math", () => {
  it("computes SMA20", () => {
    const vals = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(sma(vals, 20)).toBe(10.5);
    expect(sma([1, 2], 20)).toBeNull();
  });

  it("computes realized vol from hourly closes", () => {
    const closes = [100, 101, 99, 102, 100, 103, 101];
    const vol = realizedVolPct(closes, 24);
    expect(vol).not.toBeNull();
    expect(vol!).toBeGreaterThan(0);
  });

  it("distance and invalidation", () => {
    expect(distancePct(100, 90)).toBeCloseTo(10);
    expect(crossedInvalidation("long", 89, 90)).toBe(true);
    expect(crossedInvalidation("long", 91, 90)).toBe(false);
    expect(crossedInvalidation("short", 110, 100)).toBe(true);
    expect(moveVsSnapshotPct(105, 100)).toBeCloseTo(5);
  });

  it("parseNum", () => {
    expect(parseNum("1.5")).toBe(1.5);
    expect(parseNum("x")).toBeNull();
  });
});
