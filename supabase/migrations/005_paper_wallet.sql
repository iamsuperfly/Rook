-- Paper USDT wallet + isolated leverage fields on paper_runs.
-- Does not rewrite 001–004. Legacy paper rows stay valid with null sizing.

create table if not exists public.paper_accounts (
  chat_id bigint primary key references public.users(chat_id) on delete cascade,
  available_usdt numeric not null default 0,
  initial_claimed boolean not null default false,
  last_daily_claim_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.paper_accounts enable row level security;

drop policy if exists paper_accounts_deny_anon on public.paper_accounts;
create policy paper_accounts_deny_anon on public.paper_accounts for all to anon using (false) with check (false);

drop policy if exists paper_accounts_deny_auth on public.paper_accounts;
create policy paper_accounts_deny_auth on public.paper_accounts for all to authenticated using (false) with check (false);

alter table public.paper_runs add column if not exists margin_usdt numeric;
alter table public.paper_runs add column if not exists leverage numeric;
alter table public.paper_runs add column if not exists exposure_usdt numeric;
alter table public.paper_runs add column if not exists pnl_usdt numeric;
alter table public.paper_runs add column if not exists liquidation_price numeric;
