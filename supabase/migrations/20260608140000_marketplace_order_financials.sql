-- Marketplace order financials, escrow tracking, admin roles, and ledger scaffolding

-- Admin platform role (separate from group membership roles)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS platform_role TEXT NOT NULL DEFAULT 'user'
    CHECK (platform_role IN ('user', 'admin', 'super_admin'));

-- Order financial snapshot at purchase time
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS platform_commission_rate NUMERIC(5, 4) DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS platform_commission_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS gateway_fee_total NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS gateway_fee_platform_share NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS gateway_fee_seller_share NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS seller_net_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT CHECK (payment_gateway IN ('paystack', 'stripe')),
  ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'held'
    CHECK (escrow_status IN ('held', 'scheduled', 'released', 'frozen', 'refunded')),
  ADD COLUMN IF NOT EXISTS release_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS release_eligible_at TIMESTAMPTZ;

-- Extend seller_payouts for scheduled release (Phase 2 ready)
ALTER TABLE seller_payouts
  ADD COLUMN IF NOT EXISTS scheduled_release_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS gateway TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

-- Immutable financial audit trail
CREATE TABLE IF NOT EXISTS order_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'payment_captured', 'commission_deducted', 'gateway_fee_allocated',
    'escrow_held', 'escrow_released', 'payout_initiated', 'payout_completed',
    'refund_issued', 'refund_partial', 'dispute_freeze', 'dispute_unfreeze',
    'chargeback', 'adjustment'
  )),
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL,
  balance_after NUMERIC(12, 2),
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_order_ledger_order ON order_ledger(order_id, created_at);

-- Platform-wide marketplace settings (commission, hold periods, etc.)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO platform_settings (key, value) VALUES
  ('default_commission_rate', '0.05'),
  ('new_seller_hold_days', '7'),
  ('standard_seller_hold_days', '3'),
  ('trusted_seller_hold_days', '1'),
  ('dispute_buyer_window_days', '30'),
  ('auto_release_after_ship_days', '14')
ON CONFLICT (key) DO NOTHING;
