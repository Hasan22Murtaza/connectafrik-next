-- Remove Stripe Connect / customer columns from profiles (commerce dropped).
-- Add nullable profile banner image URL.

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS stripe_connect_account_id,
  DROP COLUMN IF EXISTS stripe_connect_onboarded,
  DROP COLUMN IF EXISTS stripe_connect_charges_enabled,
  DROP COLUMN IF EXISTS stripe_connect_payouts_enabled,
  DROP COLUMN IF EXISTS seller_reserve_balance,
  DROP COLUMN IF EXISTS stripe_customer_id;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_image TEXT;
