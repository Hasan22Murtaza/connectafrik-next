-- Message E2EE public keys and one-time keys.
-- Private keys stay in the browser. The server never stores them.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'sender_device_id'
      and data_type = 'uuid'
  ) then
    alter table public.chat_messages
      alter column sender_device_id type text using sender_device_id::text;
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'sender_device_id'
  ) then
    alter table public.chat_messages add column sender_device_id text;
  end if;
end
$$;

alter table public.chat_messages drop constraint if exists chat_messages_e2ee_version_check;
alter table public.chat_messages
  add constraint chat_messages_e2ee_version_check
  check (e2ee_version is null or e2ee_version in (1, 2));

create table if not exists public.crypto_device_keys (
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null check (char_length(device_id) between 1 and 64),
  device_keys jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create table if not exists public.crypto_one_time_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null,
  key_id text not null,
  key_json jsonb not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (user_id, device_id, key_id)
);

create index if not exists crypto_one_time_keys_unclaimed_idx
  on public.crypto_one_time_keys (user_id, device_id, created_at)
  where claimed_at is null;

create table if not exists public.crypto_fallback_keys (
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null,
  key_id text not null,
  key_json jsonb not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  primary key (user_id, device_id)
);

create table if not exists public.crypto_identities (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  master_key jsonb,
  self_signing_key jsonb,
  user_signing_key jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.crypto_claim_one_time_key(p_user_id uuid, p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_id uuid;
  chosen_key_id text;
  chosen_key jsonb;
begin
  select id, key_id, key_json
    into chosen_id, chosen_key_id, chosen_key
  from public.crypto_one_time_keys
  where user_id = p_user_id
    and device_id = p_device_id
    and claimed_at is null
  order by created_at
  for update skip locked
  limit 1;

  if chosen_id is null then
    return null;
  end if;

  update public.crypto_one_time_keys
  set claimed_at = now()
  where id = chosen_id;

  return jsonb_build_object('id', chosen_key_id, 'key', chosen_key);
end;
$$;

revoke all on function public.crypto_claim_one_time_key(uuid, text) from public, anon, authenticated;
grant execute on function public.crypto_claim_one_time_key(uuid, text) to service_role;

alter table public.crypto_device_keys enable row level security;
alter table public.crypto_one_time_keys enable row level security;
alter table public.crypto_fallback_keys enable row level security;
alter table public.crypto_identities enable row level security;

drop policy if exists crypto_device_keys_select on public.crypto_device_keys;
create policy crypto_device_keys_select on public.crypto_device_keys
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.chat_participants mine
      join public.chat_participants theirs
        on theirs.thread_id = mine.thread_id
      where mine.user_id = auth.uid()
        and theirs.user_id = crypto_device_keys.user_id
    )
  );

drop policy if exists crypto_identities_select on public.crypto_identities;
create policy crypto_identities_select on public.crypto_identities
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.chat_participants mine
      join public.chat_participants theirs
        on theirs.thread_id = mine.thread_id
      where mine.user_id = auth.uid()
        and theirs.user_id = crypto_identities.user_id
    )
  );

revoke all on public.crypto_device_keys from anon;
revoke all on public.crypto_one_time_keys from anon;
revoke all on public.crypto_fallback_keys from anon;
revoke all on public.crypto_identities from anon;

grant all on public.crypto_device_keys to service_role;
grant all on public.crypto_one_time_keys to service_role;
grant all on public.crypto_fallback_keys to service_role;
grant all on public.crypto_identities to service_role;
