-- Drop unused Megolm/Matrix-era tables. Signal E2EE only uses
-- crypto_device_keys, crypto_one_time_keys, and crypto_to_device.

drop policy if exists crypto_identities_select on public.crypto_identities;

drop table if exists public.crypto_fallback_keys;
drop table if exists public.crypto_identities;
