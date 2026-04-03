-- Remove 15-minute window for delete-for-everyone; only sender may delete.

create or replace function public.can_delete_for_everyone(
  p_message_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
begin
  select sender_id
  into v_sender_id
  from public.chat_messages
  where id = p_message_id
  limit 1;

  if v_sender_id is null then
    return false;
  end if;

  return v_sender_id = p_user_id;
end;
$$;

create or replace function public.delete_message_for_everyone(
  p_message_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
begin
  select sender_id
  into v_sender_id
  from public.chat_messages
  where id = p_message_id
  limit 1;

  if v_sender_id is null then
    raise exception 'Message not found';
  end if;

  if v_sender_id <> p_user_id then
    raise exception 'Only the sender can delete this message for everyone';
  end if;

  update public.chat_messages
  set
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where id = p_message_id;
end;
$$;
