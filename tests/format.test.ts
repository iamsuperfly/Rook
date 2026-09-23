import { describe, expect, it } from "vitest";
import { esc, invRelationLabel, snapshotLine, thesisCard, watchesText } from "@/lib/telegram/format";
import type { JudgeReport, MarketSnapshot, WatchRow } from "@/lib/types";

describe("esc", () => {
  it("escapes HTML special characters", () => {
    expect(esc(`A & B <C> "quote"`)).toBe("A &amp; B &lt;C&gt; \"quote\"");
  });
});

describe("invRelationLabel", () => {
  it("says above or below invalidation instead of dist", () => {
    expect(invRelationLabel(100, 98)).toBe("2.00% above invalidation");
    expect(invRelationLabel(100, 102)).toBe("2.00% below invalidation");
  });
});
