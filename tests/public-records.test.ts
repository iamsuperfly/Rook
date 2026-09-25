import { describe, expect, it } from "vitest";
import { recordsStats } from "@/lib/desk/paper";
import { recordsListKeyboard } from "@/lib/telegram/keyboards";
import type { PaperRunRow } from "@/lib/types";
import { asPublicProfile } from "@/lib/web/load-public";
import { toPublicCard, toPublicReceipt } from "@/lib/web/records-view";
import { normalizePublicUsername, publicRecordsUrl, publicReceiptPath } from "@/lib/web/site";

function run(over: Partial<PaperRunRow> = {}): PaperRunRow {
  return {
    id: "rec-1",
    chat_id: 42,
    watch_id: null,
    symbol: "BTCUSDT",
    horizon: "7d",
    side: "long",
    status: "stopped",
    entry_price: 83300,
    last_price: 84104,
    pnl_pct: 0.96,
    pnl_usdt: 4.8,
    thesis: {
      strategy: "Acceptance above range keeps the long intact.",
      reason: "Stored thesis text",
      invalidation_price: 82000,
      invalidation_note: "Long is wrong at or below 82000",
      i_am_wrong_if: ["Failed hold of 83k"],
    },
    invalidation: {
      price: 82000,
      note: "Long is wrong at or below 82000",
      rules: ["Failed hold of 83k"],
    },
    opened_at: "2026-09-22T09:08:38.900Z",
    closed_at: "2026-09-22T16:00:00.000Z",
    close_reason: "Human stopped paper.",
    updated_at: "",
    margin_usdt: 50,
    leverage: 10,
    exposure_usdt: 500,
    liquidation_price: 75351.5,
    ...over,
  } as unknown as PaperRunRow;
}

describe("public username and URLs", () => {
  it("normalizes telegram usernames for /u/[username]", () => {
    expect(normalizePublicUsername("@SuperFly")).toBe("SuperFly");
    expect(normalizePublicUsername("ab")).toBeNull();
    expect(publicRecordsUrl("superfly")).toMatch(/\/u\/superfly$/);
    expect(publicReceiptPath("superfly", "rec-1")).toBe("/u/superfly/receipt/rec-1");
  });

  it("refuses to publish a profile without a username", () => {
    expect(
      asPublicProfile({
        chat_id: 1,
        alerts_on: true,
        check_every: "15m",
        created_at: "",
        username: null,
      }),
    ).toBeNull();
  });
});

describe("SEE MORE keyboard", () => {
  it("adds a url button to the public records page", () => {
    const kb = recordsListKeyboard(["a", "b", "c"], "https://rook-virid.vercel.app/u/superfly");
    const flat = kb.inline_keyboard.flat();
    const see = flat.find((b) => b.text.includes("SEE MORE"));
    expect(see?.url).toBe("https://rook-virid.vercel.app/u/superfly");
    expect(flat.filter((b) => b.callback_data?.startsWith("p:open:")).length).toBe(3);
  });
});

describe("recordsStats accounting", () => {
  it("counts every closed row, but wins/losses only scored directional P&L", () => {
    const rows = [
      run({ id: "1", status: "stopped", side: "long", pnl_pct: 2 }),
      run({ id: "2", status: "invalidated", side: "long", pnl_pct: -3 }),
      run({ id: "3", status: "liquidated", side: "short", pnl_pct: -40 }),
      run({ id: "4", status: "stopped", side: "decide", pnl_pct: 1 }),
      run({ id: "5", status: "stopped", side: "long", pnl_pct: null }),
      run({ id: "6", status: "open", side: "long", pnl_pct: 5 }),
    ];
    const stats = recordsStats(rows);
    expect(stats.closed).toBe(5);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(2);
    expect(stats.liquidated).toBe(1);
  });
});

describe("public receipt uses stored thesis", () => {
  it("does not invent thesis text and keeps liquidation from position inputs", () => {
    const rec = toPublicReceipt(run());
    expect(rec.thesis).toBe("Acceptance above range keeps the long intact.");
    expect(rec.invalidation).toMatch(/82/);
    expect(rec.invRelation).toMatch(/invalidation/);
    expect(rec.liquidation).toBeTruthy();
    expect(rec.closeReason).toBe("Human stopped paper.");
    const card = toPublicCard(run());
    expect(card.symbol).toBe("BTCUSDT");
    expect(card.status).toBe("STOPPED");
  });
});
