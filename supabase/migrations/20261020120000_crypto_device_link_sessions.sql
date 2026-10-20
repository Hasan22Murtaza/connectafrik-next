-- Short-lived device linking sessions for Signal message E2EE.
-- Stores only public pairing metadata. Private keys never leave the device.
-- Reuses crypto_device_keys for registration; linking is session-status based.

create table if not exists public.crypto_device_link_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_device_id text not null check (char_length(target_device_id) between 8 and 64),
  target_identity_key text not null check (char_length(target_identity_key) between 16 and 512),
  device_name text,
  platform text,
  device_type text,
  status text not null default 'pending'
    check (status in (
      'pending',
      'scanned',
      'approved',
      'completed',
      'expired',
      'cancelled',
      'revoked'
    )),
  approved_by_device_id text,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists crypto_device_link_sessions_user_idx
  on public.crypto_device_link_sessions (user_id, created_at desc);

create index if not exists crypto_device_link_sessions_target_idx
  on public.crypto_device_link_sessions (user_id, target_device_id, status);

create index if not exists crypto_device_link_sessions_expires_idx
  on public.crypto_device_link_sessions (expires_at)
  where status in ('pending', 'scanned', 'approved');

create index if not exists crypto_device_link_sessions_status_idx
  on public.crypto_device_link_sessions (status, expires_at);

-- Atomic approve: only one trusted device can claim a pending/scanned session.
create or replace function public.crypto_approve_device_link_session(
  p_session_id uuid,
  p_user_id uuid,
  p_target_device_id text,
  p_identity_key text,
  p_approver_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.crypto_device_link_sessions%rowtype;
begin
  if p_approver_device_id is null or length(trim(p_approver_device_id)) < 8 then
    raise exception 'DEVICE_NOT_AUTHORIZED';
  end if;

  if not exists (
    select 1
    from public.crypto_device_keys
    where user_id = p_user_id
      and device_id = p_approver_device_id
  ) then
    raise exception 'DEVICE_NOT_AUTHORIZED';
  end if;

  if p_approver_device_id = p_target_device_id then
    raise exception 'DEVICE_NOT_AUTHORIZED';
  end if;

  select *
    into row
  from public.crypto_device_link_sessions
  where id = p_session_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'LINK_SESSION_NOT_FOUND';
  end if;

  if row.target_device_id <> p_target_device_id then
    raise exception 'DEVICE_NOT_FOUND';
  end if;

  if row.target_identity_key <> p_identity_key then
    raise exception 'DEVICE_PUBLIC_KEY_MISMATCH';
  end if;

  if row.status in ('completed', 'cancelled', 'revoked') then
    raise exception 'LINK_SESSION_ALREADY_USED';
  end if;

  if row.status = 'expired' or row.expires_at <= now() then
    update public.crypto_device_link_sessions
      set status = 'expired'
    where id = row.id
      and status in ('pending', 'scanned', 'approved');
    raise exception 'LINK_SESSION_EXPIRED';
  end if;

  if row.status = 'approved' then
    raise exception 'LINK_SESSION_ALREADY_USED';
  end if;

  if row.status not in ('pending', 'scanned') then
    raise exception 'LINK_APPROVAL_FAILED';
  end if;

  if not exists (
    select 1
    from public.crypto_device_keys
    where user_id = p_user_id
      and device_id = p_target_device_id
  ) then
    raise exception 'DEVICE_NOT_FOUND';
  end if;

  update public.crypto_device_link_sessions
    set status = 'approved',
        approved_by_device_id = p_approver_device_id,
        approved_at = now()
  where id = row.id
    and status in ('pending', 'scanned')
    and expires_at > now();

  if not found then
    raise exception 'LINK_APPROVAL_FAILED';
  end if;

  return jsonb_build_object(
    'sessionId', row.id,
    'deviceId', row.target_device_id,
    'status', 'approved',
    'approvedByDeviceId', p_approver_device_id
  );
end;
$$;

-- Atomic complete: single-use after approval.
create or replace function public.crypto_complete_device_link_session(
  p_session_id uuid,
  p_user_id uuid,
  p_target_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.crypto_device_link_sessions%rowtype;
begin
  select *
    into row
  from public.crypto_device_link_sessions
  where id = p_session_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'LINK_SESSION_NOT_FOUND';
  end if;

  if row.target_device_id <> p_target_device_id then
    raise exception 'DEVICE_NOT_FOUND';
  end if;

  if row.status = 'completed' then
    raise exception 'LINK_SESSION_ALREADY_USED';
  end if;

  if row.status = 'expired' or (row.status in ('pending', 'scanned', 'approved') and row.expires_at <= now()) then
    update public.crypto_device_link_sessions
      set status = 'expired'
    where id = row.id
      and status in ('pending', 'scanned', 'approved');
    raise exception 'LINK_SESSION_EXPIRED';
  end if;

  if row.status <> 'approved' then
    raise exception 'LINK_COMPLETION_FAILED';
  end if;

  if not exists (
    select 1
    from public.crypto_device_keys
    where user_id = p_user_id
      and device_id = p_target_device_id
  ) then
    raise exception 'DEVICE_NOT_FOUND';
  end if;

  update public.crypto_device_link_sessions
    set status = 'completed',
        completed_at = now()
  where id = row.id
    and status = 'approved';

  if not found then
    raise exception 'LINK_COMPLETION_FAILED';
  end if;

  return jsonb_build_object(
    'sessionId', row.id,
    'deviceId', row.target_device_id,
    'status', 'completed'
  );
end;
$$;

revoke all on function public.crypto_approve_device_link_session(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.crypto_approve_device_link_session(uuid, uuid, text, text, text)
  to service_role;

revoke all on function public.crypto_complete_device_link_session(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.crypto_complete_device_link_session(uuid, uuid, text)
  to service_role;

alter table public.crypto_device_link_sessions enable row level security;

drop policy if exists crypto_device_link_sessions_select on public.crypto_device_link_sessions;
create policy crypto_device_link_sessions_select on public.crypto_device_link_sessions
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.crypto_device_link_sessions from anon;
revoke all on public.crypto_device_link_sessions from authenticated;
grant select on public.crypto_device_link_sessions to authenticated;
grant all on public.crypto_device_link_sessions to service_role;
