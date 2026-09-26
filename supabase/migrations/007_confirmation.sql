-- Thesis confirmation stored beside invalidation.
-- Historical rows stay readable: confirmation is nullable JSON.

alter table public.watches
  add column if not exists confirmation jsonb;

alter table public.paper_runs
  add column if not exists confirmation jsonb;
