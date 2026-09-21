-- Migration 004: restore the concurrency protection that was added to the
-- 003 function after 003 had already been applied in the database.
--
-- Keep the indexes and paper_open_limit_trg created by 003 untouched.
-- Replacing the function is sufficient because the existing trigger resolves
-- this function at execution time, and CREATE OR REPLACE preserves its
-- identity.
--
-- The transaction-scoped advisory lock serializes open inserts for one
-- Telegram chat before the count is read. Inserts for different chats remain
-- independent, while concurrent inserts for the same chat cannot both observe
-- the same number of open rows and exceed the cap of 10.

create or replace function public.enforce_paper_open_limit()
returns trigger
language plpgsql
as $$
declare
  open_count int;
begin
  if NEW.status = 'open' then
    perform pg_advisory_xact_lock(NEW.chat_id);
    select count(*) into open_count
    from public.paper_runs
    where chat_id = NEW.chat_id and status = 'open';
    if open_count >= 10 then
      raise exception 'paper_open_limit';
    end if;
  end if;
  return NEW;
end;
$$;
