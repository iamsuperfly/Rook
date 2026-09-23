import { describe, expect, it } from "vitest";
import { adverseLast, paperPnlUsdt, paperExposure, stressPosition } from "@/lib/desk/paper-sim";
import { stressRowLabel } from "@/lib/telegram/paper-format";

describe("stress rows are adverse price moves", () => {
  it("SHORT 1% adverse is a higher last, not a down-print", () => {
    const last = 85917.12;
    const up = adverseLast("short", last, 1);
    expect(up).toBeCloseTo(last * 1.01);
    expect(up).toBeCloseTo(86776.29, 0);
    const exposure = paperExposure(50, 10);
    const pnl = paperPnlUsdt({ side: "short", entry: last, last: up, exposure });
    expect(pnl!).toBeLessThan(0);
    const out = stressPosition({
      side: "short",
      entry: last,
      last,
      marginUsdt: 50,
      leverage: 10,
    });
    const one = out.rows.find((r) => r.adversePct === 1)!;
    expect(one.last).toBeGreaterThan(last);
    expect(stressRowLabel(one)).toMatch(/^1% adverse move/);
    expect(stressRowLabel(one)).not.toMatch(/^−1%/);
  });

  it("LONG 1% adverse is a lower last", () => {
    const last = 100;
    expect(adverseLast("long", last, 1)).toBeCloseTo(99);
    const out = stressPosition({
      side: "long",
      entry: 100,
      last: 100,
      marginUsdt: 100,
      leverage: 10,
    });
    expect(out.rows[0].last).toBeLessThan(100);
    expect(stressRowLabel(out.rows[0])).toMatch(/^1% adverse move/);
  });
});
