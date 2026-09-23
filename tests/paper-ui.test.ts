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
