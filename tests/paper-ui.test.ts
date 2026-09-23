import { describe, expect, it } from "vitest";
import { fmtUtc } from "@/lib/telegram/format";
import {
  addMarginResultText,
  displayPnlUsdt,
  marginPromptText,
  PAPER_DISCLAIMER,
  paperCard,
} from "@/lib/telegram/paper-format";
import { JUDGE_SYSTEM } from "@/lib/desk/prompts";
import type { PaperRunRow } from "@/lib/types";

describe("displayPnlUsdt never shows 0 USDT with a live move on new wallet rows", () => {
  it("recomputes when stored pnl_usdt is 0 but last moved", () => {
    const run = {
      side: "long",
      entry_price: 100,
      last_price: 106.03,
      pnl_pct: 6.03,
      pnl_usdt: 0,
      margin_usdt: 50,
      leverage: 10,
      exposure_usdt: 500,
    } as PaperRunRow;
    const usdt = displayPnlUsdt(run);
    expect(usdt).not.toBe(0);
    expect(usdt).toBeCloseTo(30.15, 2);
  });

  it("leaves pre-wallet unlevered rows as stored (including 0)", () => {
    const run = {
      side: "long",
      entry_price: 100,
      last_price: 106.03,
      pnl_pct: 6.03,
      pnl_usdt: 0,
      margin_usdt: null,
      leverage: null,
    } as unknown as PaperRunRow;
    expect(displayPnlUsdt(run)).toBe(0);
  });
});

describe("consumer timestamps and copy", () => {
  it("formats ISO as UTC without dumping the raw string", () => {
    expect(fmtUtc("2026-09-22T09:08:38.900242+00:00")).toBe("22 Sep 2026 09:08 UTC");
    expect(fmtUtc("2026-09-22T09:08:38.900242+00:00")).not.toMatch(/T09:08/);
  });

  it("uses one short paper disclaimer", () => {
    expect(PAPER_DISCLAIMER).toBe("Paper simulation \u00b7 No real orders placed");
    expect(PAPER_DISCLAIMER.toLowerCase()).not.toMatch(/uta/);
  });

  it("margin prompt is product language with live available", () => {
    const text = marginPromptText("BTCUSDT", 10_000);
    expect(text).toMatch(/Choose how much Paper USDT/);
    expect(text).not.toMatch(/Freeze/);
    expect(text).toMatch(/10,000/);
  });
});

describe("judge prompt stays observational", () => {
  it("forbids execution-advice phrasing", () => {
    expect(JUDGE_SYSTEM).toMatch(/not trade instructions/i);
    expect(JUDGE_SYSTEM).toMatch(/scale in/);
    expect(JUDGE_SYSTEM).toMatch(/increase exposure/);
  });
});

describe("add margin copy", () => {
  it("explains unchanged exposure and falling leverage", () => {
    const text = addMarginResultText({
      oldMargin: 50,
      newMargin: 75,
      exposure: 500,
      oldLeverage: 10,
      newLeverage: 500 / 75,
    });
    expect(text).toMatch(/50/);
    expect(text).toMatch(/75/);
    expect(text).toMatch(/Exposure remains/);
    expect(text).toMatch(/10x/);
    expect(text).toMatch(/6\.67x/);
    expect(text).not.toMatch(/liquidity/i);
  });
});
