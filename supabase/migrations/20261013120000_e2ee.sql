alter table public.chat_messages
  add column if not exists e2ee_version smallint,
  add column if not exists e2ee_sender_device_id integer;

alter table public.chat_messages
  drop constraint if exists chat_messages_e2ee_version_check;

alter table public.chat_messages
  add constraint chat_messages_e2ee_version_check
  check (e2ee_version is null or e2ee_version = 1);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id integer not null check (device_id > 0),
  registration_id integer not null,
  device_name text not null,
  identity_key_public text not null,
  signed_prekey_id integer not null,
  signed_prekey_public text not null,
  signed_prekey_signature text not null,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  signed_prekey_rotated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_id)
);

create index if not exists user_devices_active_user_idx
  on public.user_devices (user_id)
  where revoked_at is null;

create table if not exists public.device_prekeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id integer not null,
  prekey_id integer not null,
  public_key text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  unique (user_id, device_id, prekey_id)
);

create index if not exists device_prekeys_available_idx
  on public.device_prekeys (user_id, device_id, prekey_id)
  where consumed_at is null;

create table if not exists public.e2ee_envelopes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_device_id integer not null,
  message_type smallint not null check (message_type in (1, 3)),
  ciphertext text not null,
  created_at timestamptz not null default now()
);

create index if not exists e2ee_envelopes_message_idx
  on public.e2ee_envelopes (message_id);

create index if not exists e2ee_envelopes_recipient_idx
  on public.e2ee_envelopes (recipient_user_id, recipient_device_id);

create table if not exists public.e2ee_key_backups (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  ciphertext text not null,
  salt text not null,
  iv text not null,
  kdf text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_devices enable row level security;
alter table public.device_prekeys enable row level security;
alter table public.e2ee_envelopes enable row level security;
alter table public.e2ee_key_backups enable row level security;

create or replace function public.e2ee_consume_prekey(p_user_id uuid, p_device_id integer)
returns table (prekey_id integer, public_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen public.device_prekeys%rowtype;
begin
  select *
    into chosen
  from public.device_prekeys
  where user_id = p_user_id
    and device_id = p_device_id
    and consumed_at is null
  order by prekey_id
  limit 1
  for update skip locked;

  if chosen.id is null then
    return;
  end if;

  update public.device_prekeys
  set consumed_at = now()
  where id = chosen.id;

  return query select chosen.prekey_id, chosen.public_key;
end;
$$;

revoke all on function public.e2ee_consume_prekey(uuid, integer) from public, anon, authenticated;
