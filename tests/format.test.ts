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

describe("snapshot and report typography", () => {
  const snap = {
    symbol: "BTCUSDT",
    last: 85863.93,
    bid: 85863.93,
    ask: 85863.94,
    high24h: 87393.73,
    low24h: 83891.32,
    volumeQuote: 483132229.84,
    change24hPct: -0.88,
    realizedVol24hPct: 2.49,
    sma20: 85973.63,
    source: "v2/spot/market/tickers",
  } as MarketSnapshot;

  it("makes symbol and last scannable", () => {
    const line = snapshotLine(snap);
    expect(line).toContain("<code>BTCUSDT</code>");
    expect(line).toMatch(/<b>85,863/);
    expect(line).toMatch(/source v2\/spot\/market\/tickers/);
  });

  it("uses Confidence / Evidence labels and no dist shorthand", () => {
    const html = thesisCard(
      {
        symbol: "BTCUSDT",
        horizon: "24h",
        bias: "short",
        confidence: 55,
        evidence_quality: 58,
        action: "watch",
        strategy: "Monitor acceptance below the range.",
        reason: "Range high rejected.",
        invalidation_price: 87393.73,
        invalidation_note: "Short is invalidated if last trades at or above 87393.73",
        bull_summary: "",
        bear_summary: "",
        catalysts: [],
        risks: [],
        i_am_wrong_if: ["Buy-side volume spikes"],
      } as JudgeReport,
      snap,
    );
    expect(html).toContain("<b>ROOK REPORT</b>");
    expect(html).toContain("<code>BTCUSDT</code>");
    expect(html).toMatch(/Confidence <b>55<\/b>/);
    expect(html).toMatch(/Evidence <b>58<\/b>/);
    expect(html).not.toMatch(/\bconf\b/);
    expect(html).not.toMatch(/\bevq\b/);
    expect(html).not.toMatch(/\bdist\b/);
    expect(html).toMatch(/above invalidation|below invalidation|at invalidation/);
  });
});

describe("watches copy", () => {
  it("does not use dist shorthand", () => {
    const text = watchesText([
      {
        id: "1",
        chat_id: 1,
        symbol: "BTCUSDT",
        horizon: "7d",
        side: "short",
        last_price: 86000,
        last_confidence: 50,
        last_action: "watch",
        invalidation: { price: 87400 },
      } as unknown as WatchRow,
    ]);
    expect(text).toContain("<b>ACTIVE WATCHES</b>");
    expect(text).not.toMatch(/\bdist\b/);
    expect(text).toMatch(/invalidation/i);
  });
});
