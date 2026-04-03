-- Link group community rows to their chat thread (resolved only via chat_threads.group_id).
alter table public.chat_threads
  add column if not exists group_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_threads_group_id_fkey'
  ) then
    alter table public.chat_threads
      add constraint chat_threads_group_id_fkey
      foreign key (group_id) references public.groups (id) on delete set null;
  end if;
end $$;

create unique index if not exists idx_chat_threads_group_id_unique
  on public.chat_threads (group_id)
  where group_id is not null;

create index if not exists idx_chat_threads_group_id
  on public.chat_threads using btree (group_id)
  where group_id is not null;
