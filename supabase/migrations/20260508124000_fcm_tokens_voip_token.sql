alter table if exists public.fcm_tokens
add column if not exists voip_token text;

create index if not exists idx_fcm_tokens_user_active_voip
on public.fcm_tokens (user_id, is_active)
where voip_token is not null;
