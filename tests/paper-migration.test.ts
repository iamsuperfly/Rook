import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration003 = readFileSync(resolve(process.cwd(), "supabase/migrations/003_paper_records.sql"), "utf8");
const migration004 = readFileSync(resolve(process.cwd(), "supabase/migrations/004_paper_open_limit_lock.sql"), "utf8");

describe("paper open-limit migrations", () => {
  it("keeps the applied 003 migration unchanged and adds the missing lock in 004", () => {
    expect(migration003).toContain("create index if not exists paper_runs_chat_status_idx");
    expect(migration003).toContain("create trigger paper_open_limit_trg");
    expect(migration004).toContain("create or replace function public.enforce_paper_open_limit()");
    expect(migration004).toContain("perform pg_advisory_xact_lock(NEW.chat_id);");
    expect(migration004).toContain("where chat_id = NEW.chat_id and status = 'open';");
  });

  it("locks each chat before counting and does not recreate 003 objects", () => {
    const lockPosition = migration004.indexOf("perform pg_advisory_xact_lock(NEW.chat_id);");
    const countPosition = migration004.indexOf("select count(*) into open_count");

    expect(lockPosition).toBeGreaterThan(-1);
    expect(countPosition).toBeGreaterThan(lockPosition);
    expect(migration004).not.toMatch(/create index/i);
    expect(migration004).not.toMatch(/drop trigger/i);
    expect(migration004).not.toMatch(/create trigger/i);
  });
});
