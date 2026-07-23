-- Links FCM rows to Supabase auth sessions so call-accept pushes can skip the accepting device.
alter table if exists public.fcm_tokens
  add column if not exists auth_session_id uuid;

create index if not exists idx_fcm_tokens_user_auth_session
  on public.fcm_tokens (user_id, auth_session_id)
  where auth_session_id is not null and is_active = true;
