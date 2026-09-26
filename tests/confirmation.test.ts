import { describe, expect, it } from "vitest";
import { crossedInvalidation } from "@/lib/bitget/scout";
import {
  applyConfirmation,
  confirmationBlobFromReport,
  crossedConfirmation,
  isValidConfirmationPrice,
  markConfirmed,
  sanitizeConfirmationPrice,
  storedConfirmation,
  thesisHealth,
} from "@/lib/desk/confirmation";
import { parseJudgeReport } from "@/lib/desk/judge";
import { JUDGE_SYSTEM } from "@/lib/desk/prompts";
import { thesisCard } from "@/lib/telegram/format";
import type { JudgeReport } from "@/lib/types";

describe("confirmation price is a future print", () => {
  it("accepts long confirmation above last and short below last", () => {
    expect(isValidConfirmationPrice("long", 100, 104)).toBe(true);
    expect(isValidConfirmationPrice("short", 100, 96)).toBe(true);
    expect(isValidConfirmationPrice("long", 100, 98)).toBe(false);
    expect(isValidConfirmationPrice("short", 100, 102)).toBe(false);
  });

  it("drops an already-printed confirmation level instead of inventing one", () => {
    expect(sanitizeConfirmationPrice({ side: "short", last: 91, proposed: 94.8 })).toBeNull();
    expect(sanitizeConfirmationPrice({ side: "short", last: 91, proposed: 90.2 })).toBe(90.2);
    expect(sanitizeConfirmationPrice({ side: "long", last: 100, proposed: null })).toBeNull();
  });

  it("reuses invalidation last-vs-price checks on the favorable side", () => {
    expect(crossedConfirmation("long", 104, 104)).toBe(crossedInvalidation("short", 104, 104));
    expect(crossedConfirmation("long", 103, 104)).toBe(crossedInvalidation("short", 103, 104));
    expect(crossedConfirmation("short", 90, 90.2)).toBe(crossedInvalidation("long", 90, 90.2));
    expect(crossedConfirmation("long", 104, 104)).toBe(true);
    expect(crossedConfirmation("long", 103, 104)).toBe(false);
    expect(crossedConfirmation("short", 90, 90.2)).toBe(true);
  });
});

describe("invalidation wins on the same print", () => {
  it("returns INVALIDATED even if confirmation also fired", () => {
    expect(
      thesisHealth({
        invalidated: true,
        confirmation: { trigger: "t", i_am_right_if: "r", price: 90, state: "confirmed" },
      }),
    ).toBe("INVALIDATED");
    expect(
      thesisHealth({
        invalidated: false,
        confirmation: { trigger: "t", i_am_right_if: "r", price: 90, state: "confirmed" },
      }),
    ).toBe("CONFIRMED");
    expect(thesisHealth({ invalidated: false })).toBe("STILL DEVELOPING");
  });

  it("markConfirmed is sticky", () => {
    const first = markConfirmed({ trigger: "t", i_am_right_if: "r", price: 90, state: "developing" });
    expect(first.state).toBe("confirmed");
    expect(markConfirmed(first).confirmed_at).toBe(first.confirmed_at);
  });
});

describe("judge parse and sanitize", () => {
  it("keeps a still-future confirmation price and derives the trigger from it", () => {
    const report = parseJudgeReport(
      JSON.stringify({
        symbol: "BTCUSDT",
        horizon: "7d",
        bias: "short",
        confidence: 55,
        strategy: "range reject",
        i_am_wrong_if: ["spike"],
        invalidation_price: 95,
        invalidation_note: "break of highs",
        confirmation_price: 90,
        confirmation_trigger: "Price breaks below the recent low.",
        confirmation_note: "The low gives way and the bearish structure continues.",
        action: "watch",
        reason: "ok",
        evidence_quality: 50,
      }),
      "BTCUSDT",
      "7d",
    );
    expect(report.confirmation_price).toBe(90);
    const cleaned = applyConfirmation(report, { last: 91, high24h: 95, low24h: 88 });
    expect(cleaned.confirmation_price).toBe(90);
    expect(cleaned.confirmation_trigger).toBe("Price trades at or below 90.");
    expect(confirmationBlobFromReport(cleaned)?.state).toBe("developing");
  });

  it("stores no confirmation when last has already printed through the level", () => {
    const report = {
      bias: "short",
      confirmation_price: 94,
      confirmation_trigger: "Price breaks above that resistance",
      confirmation_note: "resistance fails",
      invalidation_price: 95,
      invalidation_note: "",
      i_am_wrong_if: [],
    } as unknown as JudgeReport;
    const cleaned = applyConfirmation(report, { last: 91 });
    expect(cleaned.confirmation_price).toBeNull();
    expect(cleaned.confirmation_trigger).toBe("");
    expect(cleaned.confirmation_note).toBe("");
    expect(confirmationBlobFromReport(cleaned)).toBeNull();
    expect(storedConfirmation({ thesis: cleaned })).toBeNull();
  });
});

describe("telegram confirmation copy", () => {
  it("renders confirmation on the thesis card and handles missing data", () => {
    const html = thesisCard({
      symbol: "BTCUSDT",
      horizon: "24h",
      bias: "short",
      confidence: 55,
      evidence_quality: 58,
      action: "watch",
      strategy: "Monitor acceptance below the range.",
      reason: "Range high rejected.",
      invalidation_price: 94.792,
      invalidation_note: "The bearish setup is invalidated by a break above the recent high.",
      confirmation_price: 90.288,
      confirmation_trigger: "Price trades at or below 90.288.",
      confirmation_note: "The recent low breaks and the bearish structure continues to strengthen.",
      bull_summary: "",
      bear_summary: "",
      catalysts: [],
      risks: [],
      i_am_wrong_if: [],
    } as JudgeReport);
    expect(html).toContain("INVALIDATION");
    expect(html).toContain("CONFIRMATION");
    expect(html).toContain("I'm right if");
    expect(html).toContain("Still developing");
    expect(html).not.toMatch(/take profit/i);
  });

  it("judge prompt requires a future price and forbids text-only confirmation", () => {
    expect(JUDGE_SYSTEM).toMatch(/not a take-profit/i);
    expect(JUDGE_SYSTEM).toMatch(/already printed through/);
    expect(JUDGE_SYSTEM).toMatch(/text-only confirmation/);
  });
});
