-- Call E2EE device public keys and per-device sealed media keys.
-- Private keys never appear in this schema.
-- The earlier Olm-shaped user_devices table was dropped in 20261014170000.
-- This migration recreates user_devices for X25519 call devices only.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_devices'
      and column_name = 'identity_key_public'
  ) then
    raise exception
      'user_devices still has the retired Olm shape. Apply 20261014170000_chat_message_e2ee_columns.sql before call E2EE.';
  end if;
end
$$;

alter table public.call_sessions
  add column if not exists e2ee boolean not null default false;

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 64),
  public_key text not null check (char_length(public_key) between 40 and 64),
  platform text not null default 'web' check (platform in ('web', 'ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_id)
);

create index if not exists user_devices_active_user_idx
  on public.user_devices (user_id)
  where revoked_at is null;

create table if not exists public.call_keys (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions (id) on delete cascade,
  call_id text not null,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_device_id text not null,
  sender_user_id uuid not null references public.profiles (id) on delete cascade,
  sender_device_id text not null,
  sealed_key text not null check (char_length(sealed_key) between 80 and 160),
  created_at timestamptz not null default now(),
  unique (call_id, recipient_user_id, recipient_device_id)
);

create index if not exists call_keys_recipient_idx
  on public.call_keys (call_id, recipient_user_id, recipient_device_id);

create index if not exists call_keys_session_idx
  on public.call_keys (call_session_id);

alter table public.user_devices enable row level security;
alter table public.call_keys enable row level security;

drop policy if exists user_devices_select on public.user_devices;
create policy user_devices_select on public.user_devices
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.chat_participants mine
      join public.chat_participants theirs
        on theirs.thread_id = mine.thread_id
      where mine.user_id = auth.uid()
        and theirs.user_id = user_devices.user_id
    )
  );

-- Writes go through the API with the service role, which bypasses RLS.
-- Authenticated clients can read authorized public keys and their own seals only.

drop policy if exists call_keys_select on public.call_keys;
create policy call_keys_select on public.call_keys
  for select to authenticated
  using (recipient_user_id = auth.uid());

revoke all on public.user_devices from anon;
revoke all on public.call_keys from anon;
