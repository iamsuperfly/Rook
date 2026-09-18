-- Open-slot cap + indexes for MY PAPER / RECORDS.
-- Does not rewrite historical rows. Legacy side='decide' stays as-is.

create index if not exists paper_runs_chat_status_idx
  on public.paper_runs (chat_id, status);

create index if not exists paper_runs_chat_closed_idx
  on public.paper_runs (chat_id, closed_at desc)
  where status <> 'open';

create or replace function public.enforce_paper_open_limit()
returns trigger
language plpgsql
as $$
declare
  open_count int;
begin
  if NEW.status = 'open' then
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

drop trigger if exists paper_open_limit_trg on public.paper_runs;
create trigger paper_open_limit_trg
before insert on public.paper_runs
for each row
execute function public.enforce_paper_open_limit();
