-- Per-user "delete chat" (WhatsApp-style): hides thread from list and clears message history for that user.

alter table public.chat_participants
  add column if not exists deleted_at timestamptz;

comment on column public.chat_participants.deleted_at is
  'When set, this participant has deleted the chat for themselves; restored when a new message is sent or received.';

create or replace function public.delete_thread_for_user(
  p_thread_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cleared integer := 0;
begin
  if not exists (
    select 1
    from public.chat_participants
    where thread_id = p_thread_id
      and user_id = p_user_id
  ) then
    raise exception 'Not a participant in this thread';
  end if;

  v_cleared := public.clear_thread_messages_for_user(p_thread_id, p_user_id);

  update public.chat_participants
  set
    deleted_at = now(),
    unread_count = 0,
    archived = false
  where thread_id = p_thread_id
    and user_id = p_user_id;

  perform public.chat_sync_thread_unread_aggregate(p_thread_id);

  return v_cleared;
end;
$$;

-- Restore visibility when a message is sent (sender + recipients who had deleted the chat).
create or replace function public.chat_bump_unread_for_recipients(p_thread_id uuid, p_sender_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_participants
  set
    unread_count = unread_count + 1,
    deleted_at = null
  where thread_id = p_thread_id
    and user_id is distinct from p_sender_id;

  update public.chat_participants
  set deleted_at = null
  where thread_id = p_thread_id
    and user_id = p_sender_id;

  perform public.chat_sync_thread_unread_aggregate(p_thread_id);
end;
$$;

grant execute on function public.delete_thread_for_user(uuid, uuid) to authenticated, service_role;
grant execute on function public.chat_bump_unread_for_recipients(uuid, uuid) to service_role;
