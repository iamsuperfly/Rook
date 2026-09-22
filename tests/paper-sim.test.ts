import { describe, expect, it } from "vitest";
import { scorePaper } from "../lib/desk/paper";
import {
  PAPER_MMR,
  crossedLiquidation,
  dailyClaimAvailable,
  liquidationAfterAddMargin,
  liquidationPrice,
  paperExposure,
  paperPnlUsdt,
  realizedClosePnl,
  stressPosition,
  utcDayKey,
} from "../lib/desk/paper-sim";
import type { JudgeReport, PaperRunRow } from "../lib/types";

describe("paper exposure and isolated LP", () => {
  it("sizes notional as margin × leverage", () => {
    expect(paperExposure(100, 10)).toBe(1000);
  });

  it("matches the Agent Hub isolated long example", () => {
    const lp = liquidationPrice({ side: "long", entry: 100_000, leverage: 10, mmr: 0.005 });
    expect(lp).toBeCloseTo(90_500);
  });

  it("computes short LP above entry", () => {
    const lp = liquidationPrice({ side: "short", entry: 100, leverage: 10 });
    expect(lp).toBeCloseTo(100 * (1 + 0.1 - PAPER_MMR));
  });

  it("crosses long LP from above", () => {
    expect(crossedLiquidation({ side: "long", last: 90_500, liq: 90_500 })).toBe(true);
    expect(crossedLiquidation({ side: "long", last: 91_000, liq: 90_500 })).toBe(false);
  });

  it("moves LP farther after adding isolated margin", () => {
    const before = liquidationPrice({ side: "long", entry: 100, leverage: 10 });
    const after = liquidationAfterAddMargin({
      side: "long",
      entry: 100,
      exposure: 1000,
      newMargin: 150,
    });
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after!).toBeLessThan(before!);
  });
});

describe("paper P&L on exposure", () => {
  it("long 10% move on 1000 notional is +100", () => {
    expect(paperPnlUsdt({ side: "long", entry: 100, last: 110, exposure: 1000 })).toBeCloseTo(100);
  });
  it("short 10% drop on 1000 notional is +100", () => {
    expect(paperPnlUsdt({ side: "short", entry: 100, last: 90, exposure: 1000 })).toBeCloseTo(100);
  });
});

describe("scorePaper liquidation vs invalidation", () => {
  const thesis = { invalidation_price: 50 } as JudgeReport;
  const base = {
    id: "1",
    chat_id: 1,
    watch_id: null,
    symbol: "BTCUSDT",
    horizon: "7d",
    side: "long",
    status: "open",
    entry_price: 100,
    last_price: 100,
    pnl_pct: 0,
    thesis,
    invalidation: { price: 50, note: "", rules: [] },
    opened_at: "",
    closed_at: null,
    close_reason: null,
    updated_at: "",
    margin_usdt: 100,
    leverage: 10,
    exposure_usdt: 1000,
    mmr: PAPER_MMR,
    liq_price: liquidationPrice({ side: "long", entry: 100, leverage: 10 }),
  } as PaperRunRow;

  it("liquidates before thesis invalidation when LP is hit", () => {
    const scored = scorePaper(base, 90.5);
    expect(scored.status).toBe("liquidated");
  });

  it("still invalidates when last is below inv but above LP", () => {
    const scored = scorePaper(
      {
        ...base,
        leverage: 2,
        exposure_usdt: 200,
        invalidation: { price: 80, note: "", rules: [] },
        thesis: { invalidation_price: 80 } as JudgeReport,
        liq_price: liquidationPrice({ side: "long", entry: 100, leverage: 2 }),
      },
      79,
    );
    expect(scored.status).toBe("invalidated");
  });

  it("leaves legacy unlevered rows on the thesis path", () => {
    const scored = scorePaper({ ...base, margin_usdt: null, leverage: null, exposure_usdt: null, liq_price: null }, 49);
    expect(scored.status).toBe("invalidated");
  });
});

describe("isolated close accounting", () => {
  it("wipes margin on a full isolated liquidation", () => {
    expect(realizedClosePnl({ liquidated: true, marginUsdt: 100, pnlUsdt: -120 })).toBe(-100);
  });
  it("returns remaining equity minus margin when not fully gone", () => {
    expect(realizedClosePnl({ liquidated: true, marginUsdt: 100, pnlUsdt: -80 })).toBe(-80);
  });
});

describe("daily claim UTC day", () => {
  it("allows a first claim", () => {
    expect(dailyClaimAvailable(null)).toBe(true);
  });
  it("blocks a second claim on the same UTC day", () => {
    const now = new Date("2026-09-22T02:00:00.000Z");
    expect(dailyClaimAvailable("2026-09-22T00:10:00.000Z", now)).toBe(false);
    expect(dailyClaimAvailable("2026-09-21T23:50:00.000Z", now)).toBe(true);
    expect(utcDayKey(now)).toBe("2026-09-22");
  });
});

describe("stress rows", () => {
  it("keeps a 10x long 5% adverse above LP", () => {
    const out = stressPosition({
      side: "long",
      entry: 100,
      last: 100,
      marginUsdt: 100,
      leverage: 10,
      extraMargin: 50,
    });
    const five = out.rows.find((r) => r.adversePct === 5);
    expect(five?.wouldLiquidate).toBe(false);
    expect(out.withExtraLiq).not.toBeNull();
    expect(out.withExtraLiq!).toBeLessThan(out.baselineLiq!);
  });
});
