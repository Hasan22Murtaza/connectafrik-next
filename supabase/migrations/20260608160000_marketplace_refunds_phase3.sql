-- Phase 3: Refunds and cancellations

CREATE TABLE IF NOT EXISTS refund_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  dispute_id UUID,
  payment_transaction_id UUID REFERENCES payment_transactions(id),
  gateway TEXT NOT NULL CHECK (gateway IN ('paystack', 'stripe')),
  gateway_refund_id TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  initiated_by UUID REFERENCES auth.users(id),
  initiator_role TEXT CHECK (initiator_role IN ('buyer', 'seller', 'admin', 'system')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_refund_transactions_order
  ON refund_transactions (order_id, created_at DESC);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none'
    CHECK (refund_status IN ('none', 'partial', 'full')),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

INSERT INTO platform_settings (key, value) VALUES
  ('allow_buyer_cancel_before_ship', 'true'),
  ('auto_refund_on_pre_ship_cancel', 'true')
ON CONFLICT (key) DO NOTHING;
