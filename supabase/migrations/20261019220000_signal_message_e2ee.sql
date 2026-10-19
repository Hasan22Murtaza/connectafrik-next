-- Signal Protocol message E2EE (e2ee_version = 3).
-- Reuses crypto_* tables for public key / prekey / to-device relay.
-- Private keys never appear in this schema. Legacy Megolm rows (version 2) remain readable as locked.

alter table public.chat_messages drop constraint if exists chat_messages_e2ee_version_check;
alter table public.chat_messages
  add constraint chat_messages_e2ee_version_check
  check (e2ee_version is null or e2ee_version in (1, 2, 3));

-- Optional per-device envelope fan-out for clients that prefer relational storage.
-- The web client currently embeds envelopes inside chat_messages.ciphertext JSON.
create table if not exists public.signal_message_envelopes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  recipient_device_id text not null check (char_length(recipient_device_id) between 8 and 64),
  message_type smallint not null check (message_type in (1, 3)),
  ciphertext text not null,
  created_at timestamptz not null default now(),
  unique (message_id, recipient_user_id, recipient_device_id)
);

create index if not exists signal_message_envelopes_recipient_idx
  on public.signal_message_envelopes (recipient_user_id, recipient_device_id, created_at);

alter table public.signal_message_envelopes enable row level security;

drop policy if exists signal_message_envelopes_select on public.signal_message_envelopes;
create policy signal_message_envelopes_select on public.signal_message_envelopes
  for select to authenticated
  using (recipient_user_id = auth.uid());
