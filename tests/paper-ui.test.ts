import { describe, expect, it } from "vitest";
import { fmtUtc } from "@/lib/telegram/format";
import { displayPnlUsdt, marginPromptText, PAPER_DISCLAIMER, paperCard } from "@/lib/telegram/paper-format";
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

describe("paper card", () => {
  it("labels estimated liquidation as simulated", () => {
    const card = paperCard({
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
      pnl_usdt: 0,
      thesis: { strategy: "Monitor acceptance below the range." },
      invalidation: {
        price: 87400,
        note: "Short is invalidated if last trades at or above 87400",
        rules: ["Buy-side volume spikes"],
      },
      opened_at: "2026-09-22T09:08:38.900242+00:00",
      closed_at: null,
      close_reason: null,
      updated_at: "",
      margin_usdt: 50,
      leverage: 10,
      exposure_usdt: 500,
      liquidation_price: 94500,
    } as unknown as PaperRunRow);
    expect(card).toMatch(/Est\. liq \(sim\)/);
    expect(card).toMatch(/22 Sep 2026 09:08 UTC/);
    expect(card).toMatch(/87400/);
    expect(card).toMatch(/Paper simulation/);
    expect(card).not.toMatch(/Still no order on Bitget/);
  });
});
