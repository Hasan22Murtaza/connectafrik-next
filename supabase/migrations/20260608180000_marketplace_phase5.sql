-- Phase 5: Stripe Connect, chargebacks, seller reserve, admin reporting support

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_reserve_balance NUMERIC(12, 2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS chargeback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES auth.users(id),
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'paystack')),
  gateway_dispute_id TEXT NOT NULL,
  payment_reference TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'won', 'lost', 'warning_closed', 'under_review')),
  reason TEXT,
  seller_debited_amount NUMERIC(12, 2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chargeback_gateway_dispute
  ON chargeback_events (gateway, gateway_dispute_id);

CREATE INDEX IF NOT EXISTS idx_chargeback_events_seller
  ON chargeback_events (seller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS seller_reserve_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'chargeback_debit', 'chargeback_reversal', 'manual_credit', 'manual_debit', 'payout_hold'
  )),
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance_after NUMERIC(12, 2),
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_reserve_ledger
  ON seller_reserve_ledger (seller_id, created_at DESC);

INSERT INTO platform_settings (key, value) VALUES
  ('chargeback_reserve_rate', '0.05'),
  ('stripe_connect_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
