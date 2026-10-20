-- Remove device-link pairing (QR / session approve). Signal key tables stay.

drop function if exists public.crypto_approve_device_link_session(uuid, uuid, text, text, text);
drop function if exists public.crypto_complete_device_link_session(uuid, uuid, text);

drop policy if exists crypto_device_link_sessions_select on public.crypto_device_link_sessions;

drop index if exists public.crypto_device_link_sessions_user_idx;
drop index if exists public.crypto_device_link_sessions_target_idx;
drop index if exists public.crypto_device_link_sessions_expires_idx;
drop index if exists public.crypto_device_link_sessions_status_idx;

drop table if exists public.crypto_device_link_sessions;
