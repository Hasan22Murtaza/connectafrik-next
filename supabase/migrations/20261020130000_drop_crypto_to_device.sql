-- Device linking uses crypto_device_link_sessions only.
-- Drop the unused to-device ciphertext relay table.

drop policy if exists crypto_to_device_select on public.crypto_to_device;
drop index if exists public.crypto_to_device_recipient_idx;
drop table if exists public.crypto_to_device;
