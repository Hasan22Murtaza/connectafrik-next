-- Accurate per-user unread on chat_participants (fixes drift when reads are idempotent).

create or replace function public.chat_recalc_participant_unread(p_thread_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_participants cp
  set unread_count = coalesce((
    select count(*)::integer
    from public.chat_messages cm
    where cm.thread_id = p_thread_id
      and cm.is_deleted = false
      and cm.sender_id is distinct from p_user_id
      and not exists (
        select 1 from public.message_reads mr
        where mr.message_id = cm.id and mr.user_id = p_user_id
      )
  ), 0)
  where cp.thread_id = p_thread_id and cp.user_id = p_user_id;

  perform public.chat_sync_thread_unread_aggregate(p_thread_id);
end;
$$;

grant execute on function public.chat_recalc_participant_unread(uuid, uuid) to service_role;
revoke all on function public.chat_recalc_participant_unread(uuid, uuid) from public;
