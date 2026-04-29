-- Per-user unread (chat_participants) and denormalized thread total (chat_threads).

alter table public.chat_participants
  add column if not exists unread_count integer not null default 0;

alter table public.chat_threads
  add column if not exists unread_count integer not null default 0;

-- Backfill participant counts from message_reads, then sync thread totals.
update public.chat_participants set unread_count = 0;

update public.chat_participants cp
set unread_count = coalesce(agg.c, 0)
from (
  select
    cp2.thread_id,
    cp2.user_id,
    count(cm.id)::integer as c
  from public.chat_participants cp2
  join public.chat_messages cm
    on cm.thread_id = cp2.thread_id
    and cm.is_deleted = false
    and cm.sender_id is distinct from cp2.user_id
  left join public.message_reads mr
    on mr.message_id = cm.id
    and mr.user_id = cp2.user_id
  where mr.message_id is null
  group by cp2.thread_id, cp2.user_id
) agg
where cp.thread_id = agg.thread_id
  and cp.user_id = agg.user_id;

update public.chat_threads t
set unread_count = coalesce(s.sum_u, 0)
from (
  select thread_id, sum(unread_count)::integer as sum_u
  from public.chat_participants
  group by thread_id
) s
where t.id = s.thread_id;

create or replace function public.chat_sync_thread_unread_aggregate(p_thread_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_threads
  set unread_count = coalesce((
    select sum(unread_count)::integer
    from public.chat_participants
    where thread_id = p_thread_id
  ), 0)
  where id = p_thread_id;
$$;

create or replace function public.chat_bump_unread_for_recipients(p_thread_id uuid, p_sender_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_participants
  set unread_count = unread_count + 1
  where thread_id = p_thread_id
    and user_id is distinct from p_sender_id;

  perform public.chat_sync_thread_unread_aggregate(p_thread_id);
end;
$$;

grant execute on function public.chat_sync_thread_unread_aggregate(uuid) to service_role;
grant execute on function public.chat_bump_unread_for_recipients(uuid, uuid) to service_role;

revoke all on function public.chat_sync_thread_unread_aggregate(uuid) from public;
revoke all on function public.chat_bump_unread_for_recipients(uuid, uuid) from public;
