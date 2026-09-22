import { describe, expect, it } from "vitest";
import { describeError } from "../lib/desk/errors";
import { asPaperRun } from "../lib/db/paper";
import { scorePaper } from "../lib/desk/paper";
import { liquidationPrice } from "../lib/desk/paper-sim";
import type { JudgeReport, PaperRunRow } from "../lib/types";

describe("describeError", () => {
  it("reads Error.message", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
  });
  it("reads Postgrest-shaped objects that are not Error instances", () => {
    expect(
      describeError({
        message: "Could not find the 'claimed_initial' column of 'paper_accounts' in the schema cache",
        code: "PGRST204",
        details: "column missing",
      }),
    ).toContain("claimed_initial");
  });
  it("does not collapse a plain object to unknown", () => {
    expect(describeError({ message: "wallet down" })).toBe("wallet down");
  });
});

describe("asPaperRun schema aliases", () => {
  it("copies applied 005 liquidation_price onto liq_price", () => {
    const row = asPaperRun({
      id: "1",
      chat_id: 1,
      liquidation_price: 90.5,
    });
    expect(row.liquidation_price).toBe(90.5);
    expect(row.liq_price).toBe(90.5);
  });
});

describe("scorePaper reads applied 005 LP column", () => {
  it("liquidates using liquidation_price when liq_price is absent", () => {
    const thesis = { invalidation_price: 50 } as JudgeReport;
    const run = {
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
      liquidation_price: liquidationPrice({ side: "long", entry: 100, leverage: 10 }),
    } as PaperRunRow;
    expect(scorePaper(run, 90.5).status).toBe("liquidated");
  });
});
