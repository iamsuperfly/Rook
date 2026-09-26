import { describe, expect, it } from "vitest";
import { fmtUtc } from "@/lib/telegram/format";
import {
  addMarginResultText,
  displayPnlUsdt,
  marginPromptText,
  noBiasText,
  PAPER_DISCLAIMER,
  paperCard,
  paperListText,
  recordsListText,
  walletText,
} from "@/lib/telegram/paper-format";
import { JUDGE_SYSTEM } from "@/lib/desk/prompts";
import { resolveCallLiveSide } from "@/lib/desk/paper";
import type { PaperRunRow } from "@/lib/types";

function openRun(over: Partial<PaperRunRow> = {}): PaperRunRow {
  return {
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
    ...over,
  } as unknown as PaperRunRow;
}

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
    expect(JUDGE_SYSTEM).toMatch(/confirmation/);
  });
});

describe("paper card", () => {
  it("labels estimated liquidation as simulated", () => {
    const card = paperCard(openRun());
    expect(card).toMatch(/Estimated liquidation \(sim\)/);
    expect(card).toMatch(/22 Sep 2026 09:08 UTC/);
    expect(card).toMatch(/87400/);
    expect(card).toMatch(/Paper simulation/);
    expect(card).toContain("<code>BTCUSDT</code>");
    expect(card).not.toMatch(/Still no order on Bitget/);
    expect(card).not.toMatch(/\bLP\b/);
  });

  it("shows confirmation without treating it as an exit", () => {
    const developing = paperCard(
      openRun({
        confirmation: {
          trigger: "Price trades at or below 84000.",
          i_am_right_if: "The range low gives way.",
          price: 84000,
          state: "developing",
        },
      }),
    );
    expect(developing).toContain("CONFIRMATION");
    expect(developing).toContain("Still developing");
    expect(developing).toContain("I'm right if");
    expect(developing).not.toMatch(/take profit/i);
    expect(developing).toMatch(/OPEN/);
    expect(developing).not.toContain("PAPER RECORD");
    expect(developing).not.toContain("CLOSE REASON");

    const confirmed = paperCard(
      openRun({
        confirmation: {
          trigger: "Price trades at or below 84000.",
          i_am_right_if: "The range low gives way.",
          price: 84000,
          state: "confirmed",
        },
      }),
    );
    expect(confirmed).toContain("CONFIRMATION");
    expect(confirmed).toContain("CONFIRMED");
    expect(confirmed).toMatch(/OPEN/);
    expect(confirmed).not.toContain("PAPER RECORD");
    expect(confirmed).not.toContain("CLOSE REASON");
    expect(confirmed).not.toMatch(/take profit/i);
  });
});

describe("add-margin copy", () => {
  it("explains margin up, exposure same, leverage down", () => {
    const text = addMarginResultText({
      beforeMargin: 50,
      afterMargin: 75,
      exposure: 500,
      beforeLeverage: 10,
      afterLeverage: 500 / 75,
    });
    expect(text).toMatch(/50/);
    expect(text).toMatch(/75/);
    expect(text).toMatch(/Exposure remains/);
    expect(text).toMatch(/500/);
    expect(text).toMatch(/10/);
    expect(text).toMatch(/6\.67/);
    expect(text).not.toMatch(/liquidity/i);
  });
});

describe("MY PAPER vs RECORDS", () => {
  it("lists only open rows in MY PAPER", () => {
    const text = paperListText([
      openRun({ id: "1", symbol: "BTCUSDT" }),
      openRun({ id: "2", symbol: "NVDAUSDT", status: "stopped", pnl_pct: 1 }),
    ]);
    expect(text).toContain("<b>MY PAPER</b>");
    expect(text).toContain("BTCUSDT");
    expect(text).not.toContain("NVDAUSDT");
    expect(text).toMatch(/1\/10/);
  });

  it("lists closed rows including liquidated in RECORDS", () => {
    const text = recordsListText([
      openRun({ id: "2", symbol: "NVDAUSDT", status: "liquidated", pnl_pct: -100, pnl_usdt: -50 }),
      openRun({ id: "3", symbol: "TSLAUSDT", status: "invalidated", pnl_pct: -2 }),
    ]);
    expect(text).toContain("<b>RECORDS</b>");
    expect(text).toContain("NVDAUSDT");
    expect(text).toMatch(/LIQUIDATED/);
    expect(text).toContain("TSLAUSDT");
    expect(text).toMatch(/INVALIDATED/);
  });
});

describe("NONE thesis paper choice", () => {
  it("requires an explicit LONG/SHORT", () => {
    expect(resolveCallLiveSide("none")).toBeNull();
    expect(resolveCallLiveSide("none", "long")).toBe("long");
    expect(noBiasText("BTCUSDT")).toMatch(/NONE/);
    expect(noBiasText("BTCUSDT")).toMatch(/LONG or SHORT/);
  });
});

describe("wallet scan lines", () => {
  it("shows the four core numbers", () => {
    const text = walletText({
      paperBalance: 10000,
      available: 9500,
      inPositions: 500,
      canClaimInitial: false,
      canClaimDaily: true,
    });
    expect(text).toContain("<b>PAPER WALLET</b>");
    expect(text).toMatch(/Balance/);
    expect(text).toMatch(/Available/);
    expect(text).toMatch(/In positions/);
    expect(text).toMatch(/Daily claim/);
  });
});
