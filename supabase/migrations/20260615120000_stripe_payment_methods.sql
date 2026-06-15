-- Saved Stripe payment methods (marketplace wallet)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE TABLE IF NOT EXISTS stripe_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  payment_method_id TEXT NOT NULL UNIQUE,
  last_four TEXT NOT NULL,
  card_brand TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_user
  ON stripe_payment_methods (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_payment_methods_default_per_user
  ON stripe_payment_methods (user_id)
  WHERE is_default = true;
