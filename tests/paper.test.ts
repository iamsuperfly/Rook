import { describe, expect, it } from "vitest";
import { paperPnlPct } from "../lib/desk/paper";

describe("paperPnlPct", () => {
  it("long profits when last rises", () => {
    expect(paperPnlPct("long", 100, 110)).toBeCloseTo(10);
  });
  it("short profits when last falls", () => {
    expect(paperPnlPct("short", 100, 90)).toBeCloseTo(10);
  });
  it("does not score legacy decide rows", () => {
    expect(paperPnlPct("decide", 50, 55)).toBeNull();
  });
});
