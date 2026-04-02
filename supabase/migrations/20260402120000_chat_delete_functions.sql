-- Chat deletion RPCs used by API routes
-- Safe to run multiple times

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
  v_created_at timestamptz;
begin
  select sender_id, created_at
  into v_sender_id, v_created_at
  from public.chat_messages
  where id = p_message_id
  limit 1;

  if v_sender_id is null then
    return false;
  end if;

  if v_sender_id <> p_user_id then
    return false;
  end if;

  return (now() - v_created_at) <= interval '15 minutes';
end;
$$;

create or replace function public.delete_message_for_user(
  p_message_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_messages
  set deleted_for = case
    when deleted_for is null then array[p_user_id]
    when not (p_user_id = any(deleted_for)) then array_append(deleted_for, p_user_id)
    else deleted_for
  end,
  updated_at = now()
  where id = p_message_id;
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
begin
  if not public.can_delete_for_everyone(p_message_id, p_user_id) then
    raise exception 'Can only delete for everyone within 15 minutes of sending';
  end if;

  update public.chat_messages
  set
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  where id = p_message_id;
end;
$$;

create or replace function public.clear_thread_messages_for_user(
  p_thread_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.chat_messages m
  set deleted_for = case
    when m.deleted_for is null then array[p_user_id]
    when not (p_user_id = any(m.deleted_for)) then array_append(m.deleted_for, p_user_id)
    else m.deleted_for
  end,
  updated_at = now()
  where m.thread_id = p_thread_id
    and coalesce(m.is_deleted, false) = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.can_delete_for_everyone(uuid, uuid) to authenticated, service_role;
grant execute on function public.delete_message_for_user(uuid, uuid) to authenticated, service_role;
grant execute on function public.delete_message_for_everyone(uuid, uuid) to authenticated, service_role;
grant execute on function public.clear_thread_messages_for_user(uuid, uuid) to authenticated, service_role;
