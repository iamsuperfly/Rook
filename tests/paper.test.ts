import { describe, expect, it } from "vitest";
import { canOpenAnotherPaper, MAX_OPEN_PAPER, paperPnlPct } from "../lib/desk/paper";
import { mainReplyKeyboard } from "../lib/telegram/keyboards";

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

describe("open paper cap", () => {
  it("allows a new open only under 10 and frees the slot when closed", () => {
    expect(MAX_OPEN_PAPER).toBe(10);
    expect(canOpenAnotherPaper(0)).toBe(true);
    expect(canOpenAnotherPaper(9)).toBe(true);
    expect(canOpenAnotherPaper(10)).toBe(false);
  });
});

describe("reply keyboard", () => {
  it("is not persistent so Android Back can hide it", () => {
    expect(mainReplyKeyboard().is_persistent).toBe(false);
    expect(mainReplyKeyboard().resize_keyboard).toBe(true);
  });
});
