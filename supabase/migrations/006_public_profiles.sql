-- Public Records profiles. Identity stays chat_id / telegram_user_id.
-- Username is display + URL only and may change.

alter table public.users
  add column if not exists telegram_user_id bigint;

alter table public.users
  add column if not exists username text;

alter table public.users
  add column if not exists first_name text;

alter table public.users
  add column if not exists photo_file_id text;

alter table public.users
  add column if not exists photo_updated_at timestamptz;

update public.users
  set telegram_user_id = chat_id
  where telegram_user_id is null;

create unique index if not exists users_username_lower_idx
  on public.users (lower(username))
  where username is not null;

create index if not exists users_telegram_user_idx
  on public.users (telegram_user_id);
