import { describe, expect, it } from "vitest";
import { extractJsonObject, parseJudgeReport } from "@/lib/desk/judge";
import { shouldRewriteJudge } from "@/lib/desk/debate";
import { esc } from "@/lib/telegram/format";

describe("JSON extractor", () => {
  it("pulls fenced json", () => {
    const raw = 'intro\n```json\n{"symbol":"BTCUSDT","action":"watch"}\n```\n';
    expect(extractJsonObject(raw)).toContain('"symbol"');
  });

  it("pulls first object", () => {
    expect(extractJsonObject('noise { "a": { "b": 1 } } tail')).toBe('{ "a": { "b": 1 } }');
  });
});

describe("parseJudgeReport", () => {
  it("parses a valid judge payload", () => {
    const text = JSON.stringify({
      symbol: "BTCUSDT",
      horizon: "7d",
      bias: "long",
      confidence: 72,
      strategy: "hold the line",
      bull_summary: "up",
      bear_summary: "down",
      catalysts: ["etf"],
      risks: ["liq"],
      i_am_wrong_if: ["lose 90k"],
      invalidation_price: 90000,
      invalidation_note: "daily close",
      action: "watch",
      reason: "ok",
      evidence_quality: 61,
    });
    const r = parseJudgeReport(text, "BTCUSDT", "7d");
    expect(r.action).toBe("watch");
    expect(r.confidence).toBe(72);
    expect(r.parse_error).toBeUndefined();
  });

  it("rejects unparseable text", () => {
    const r = parseJudgeReport("sorry I cannot", "BTCUSDT", "24h");
    expect(r.action).toBe("reject");
    expect(r.reason).toBe("parse_error");
    expect(r.parse_error).toBe(true);
  });
});

describe("rewrite gate", () => {
  it("rewrites on cross, force, or >5% move", () => {
    expect(shouldRewriteJudge({ crossed: true, moveAbsPct: 0 })).toBe(true);
    expect(shouldRewriteJudge({ force: true, crossed: false, moveAbsPct: 0 })).toBe(true);
    expect(shouldRewriteJudge({ crossed: false, moveAbsPct: 5.1 })).toBe(true);
    expect(shouldRewriteJudge({ crossed: false, moveAbsPct: 1.2 })).toBe(false);
  });
});

describe("html escape", () => {
  it("escapes markup", () => {
    expect(esc("<b>&</b>")).toBe("&lt;b&gt;&amp;&lt;/b&gt;");
  });
});
