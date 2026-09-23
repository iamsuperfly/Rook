import { describe, expect, it } from "vitest";
import { crossedInvalidation } from "@/lib/bitget/scout";
import {
  applyAuthoritativeInvalidation,
  authoritativeInvalidationPrice,
  paperInvalidationBlob,
  sameInvalidationLine,
} from "@/lib/desk/invalidation";
import { scorePaper } from "@/lib/desk/paper";
import type { JudgeReport, PaperRunRow } from "@/lib/types";

describe("authoritative invalidation for SHORT", () => {
  const last = 85863.93;
  it("rejects snapshot last as a short close line", () => {
    const price = authoritativeInvalidationPrice({
      side: "short",
      last,
      proposed: last,
      high24h: 87400,
    });
    expect(price).toBe(87400);
    expect(price!).toBeGreaterThan(last);
  });

  it("does not close a short at a tiny tick above last when high24h is the line", () => {
    const price = authoritativeInvalidationPrice({
      side: "short",
      last,
      proposed: last,
      high24h: 87400,
    });
    expect(crossedInvalidation("short", 85935.62, price)).toBe(false);
    expect(crossedInvalidation("short", 87400, price)).toBe(true);
  });

  it("keeps a model price that is already above last", () => {
    expect(
      authoritativeInvalidationPrice({ side: "short", last, proposed: 88000, high24h: 87400 }),
    ).toBe(88000);
  });
});

describe("authoritative invalidation for LONG", () => {
  it("rejects snapshot last and prefers 24h low", () => {
    const price = authoritativeInvalidationPrice({
      side: "long",
      last: 100,
      proposed: 100,
      low24h: 96,
    });
    expect(price).toBe(96);
    expect(crossedInvalidation("long", 97, price)).toBe(false);
    expect(crossedInvalidation("long", 96, price)).toBe(true);
  });
});

describe("display / store / score agree", () => {
  it("thesis, stored blob, and scorePaper share one short close line", () => {
    const report = applyAuthoritativeInvalidation(
      {
        symbol: "BTCUSDT",
        horizon: "7d",
        bias: "short",
        confidence: 40,
        strategy: "Watch acceptance below the range.",
        bull_summary: "",
        bear_summary: "",
        catalysts: [],
        risks: [],
        i_am_wrong_if: ["Buy-side volume spikes"],
        invalidation_price: 85863.93,
        invalidation_note: "If price closes at or below the snapshot last price, the short bias is invalidated.",
        action: "watch",
        reason: "",
        evidence_quality: 40,
      } as JudgeReport,
      { last: 85863.93, high24h: 87400, low24h: 84000, sma20: 86000 },
    );
    expect(report.invalidation_price).toBe(87400);
    expect(report.invalidation_note).toMatch(/at or above 87400/);
    const blob = paperInvalidationBlob(report);
    expect(sameInvalidationLine(report.invalidation_price, blob.price)).toBe(true);

    const run = {
      id: "1",
      chat_id: 1,
      watch_id: null,
      symbol: "BTCUSDT",
      horizon: "7d",
      side: "short",
      status: "open",
      entry_price: 85917.12,
      last_price: 85917.12,
      pnl_pct: 0,
      thesis: report,
      invalidation: blob,
      opened_at: "",
      closed_at: null,
      close_reason: null,
      updated_at: "",
      margin_usdt: 50,
      leverage: 10,
      exposure_usdt: 500,
    } as PaperRunRow;

    expect(scorePaper(run, 85935.62).status).toBe("open");
    const crossed = scorePaper(run, 87400);
    expect(crossed.status).toBe("invalidated");
    expect(crossed.close_reason).toContain("87400");
  });

  it("rewrites a plausible but side-wrong note to the stored close line", () => {
    const report = applyAuthoritativeInvalidation(
      {
        symbol: "BTCUSDT",
        horizon: "24h",
        bias: "short",
        confidence: 55,
        strategy: "Monitor acceptance below the range.",
        bull_summary: "",
        bear_summary: "",
        catalysts: [],
        risks: [],
        i_am_wrong_if: ["Price breaking above ~87,400"],
        invalidation_price: 85863.93,
        invalidation_note: "Short invalidates at or below the last print.",
        action: "watch",
        reason: "",
        evidence_quality: 58,
      } as JudgeReport,
      { last: 85863.93, high24h: 87393.73, low24h: 83891.32, sma20: 85973.63 },
    );
    expect(report.invalidation_price).toBe(87393.73);
    expect(report.invalidation_note).toMatch(/at or above 87393\.73/);
    expect(report.invalidation_note).not.toMatch(/at or below/);
    expect(report.i_am_wrong_if[0]).toMatch(/87,400/);
  });
});
