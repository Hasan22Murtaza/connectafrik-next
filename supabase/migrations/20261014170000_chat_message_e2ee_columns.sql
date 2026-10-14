-- chat_messages keeps only these encryption columns. Device, envelope, and backup tables are not used.

alter table public.chat_messages
  add column if not exists ciphertext text,
  add column if not exists megolm_session_id text,
  add column if not exists sender_device_id uuid,
  add column if not exists e2ee_version smallint;

alter table public.chat_messages
  drop column if exists e2ee_sender_device_id,
  drop column if exists e2ee_ciphertext;

drop table if exists public.e2ee_envelopes;
drop table if exists public.device_prekeys;
drop table if exists public.user_devices;
drop table if exists public.e2ee_key_backups;

drop function if exists public.e2ee_consume_prekey(uuid, integer);
