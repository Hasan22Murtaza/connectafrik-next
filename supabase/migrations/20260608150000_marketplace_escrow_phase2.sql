-- Phase 2: Escrow scheduling, seller tiers, delivery tracking, cron indexes

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS seller_tier TEXT
    CHECK (seller_tier IS NULL OR seller_tier IN ('new', 'standard', 'trusted'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by UUID REFERENCES auth.users(id);

-- Fast lookup for escrow release cron
CREATE INDEX IF NOT EXISTS idx_orders_escrow_release_eligible
  ON orders (release_eligible_at ASC)
  WHERE escrow_status = 'scheduled'
    AND (payout_status IS NULL OR payout_status NOT IN ('completed', 'cancelled'));

INSERT INTO platform_settings (key, value) VALUES
  ('new_seller_order_threshold', '10'),
  ('trusted_seller_order_threshold', '50')
ON CONFLICT (key) DO NOTHING;

-- Prevent duplicate payouts per order (when idempotency_key not set on legacy rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_payouts_order_idempotency
  ON seller_payouts (order_id)
  WHERE status NOT IN ('failed', 'cancelled');
