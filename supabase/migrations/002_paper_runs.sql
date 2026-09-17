-- Paper book. No exchange orders. Service role only.

create table if not exists public.paper_runs (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null references public.users(chat_id) on delete cascade,
  watch_id uuid references public.watches(id) on delete set null,
  symbol text not null,
  horizon text not null,
  side text not null,
  status text not null default 'open',
  entry_price numeric not null,
  last_price numeric,
  pnl_pct numeric,
  thesis jsonb not null,
  invalidation jsonb,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text,
  updated_at timestamptz not null default now()
);

create index if not exists paper_runs_chat_open_idx
  on public.paper_runs (chat_id, status, updated_at desc);

alter table public.paper_runs enable row level security;

drop policy if exists paper_deny_anon on public.paper_runs;
create policy paper_deny_anon on public.paper_runs for all to anon using (false) with check (false);

drop policy if exists paper_deny_auth on public.paper_runs;
create policy paper_deny_auth on public.paper_runs for all to authenticated using (false) with check (false);
