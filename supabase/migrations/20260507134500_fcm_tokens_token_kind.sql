alter table if exists public.fcm_tokens
add column if not exists token_kind text not null default 'standard';

alter table if exists public.fcm_tokens
drop constraint if exists fcm_tokens_token_kind_check;

alter table if exists public.fcm_tokens
add constraint fcm_tokens_token_kind_check
check (token_kind in ('standard', 'voip'));

create index if not exists idx_fcm_tokens_user_active_kind
on public.fcm_tokens (user_id, is_active, token_kind);
