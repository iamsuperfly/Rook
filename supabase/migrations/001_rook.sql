-- Rook schema. Apply in Supabase SQL editor or via CLI.
-- Server uses the service role. Anon is denied by RLS.

create table if not exists public.users (
  chat_id bigint primary key,
  alerts_on boolean not null default true,
  check_every text not null default '15m',
  created_at timestamptz not null default now()
);

create table if not exists public.watches (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null references public.users(chat_id) on delete cascade,
  symbol text not null,
  horizon text not null,
  side text not null,
  active boolean not null default true,
  last_price numeric,
  last_confidence int,
  last_action text,
  last_thesis jsonb,
  invalidation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists watches_one_active
  on public.watches (chat_id, symbol, horizon)
  where active = true;

create index if not exists watches_active_idx on public.watches (active, updated_at desc);
create index if not exists watches_chat_idx on public.watches (chat_id);

alter table public.users enable row level security;
alter table public.watches enable row level security;

drop policy if exists users_deny_anon on public.users;
create policy users_deny_anon on public.users
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists watches_deny_anon on public.watches;
create policy watches_deny_anon on public.watches
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists users_deny_auth on public.users;
create policy users_deny_auth on public.users
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists watches_deny_auth on public.watches;
create policy watches_deny_auth on public.watches
  for all
  to authenticated
  using (false)
  with check (false);
