-- Phase 4: Dispute resolution system

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS dispute_id UUID;

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL CHECK (reason IN (
    'not_received', 'not_as_described', 'damaged', 'wrong_item',
    'counterfeit', 'missing_parts', 'other'
  )),
  description TEXT NOT NULL,
  requested_resolution TEXT NOT NULL DEFAULT 'full_refund'
    CHECK (requested_resolution IN ('full_refund', 'partial_refund', 'replacement', 'other')),
  requested_amount NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'awaiting_seller' CHECK (status IN (
    'open', 'awaiting_seller', 'under_review', 'resolved_buyer',
    'resolved_seller', 'resolved_partial', 'withdrawn', 'closed'
  )),
  assigned_admin_id UUID REFERENCES auth.users(id),
  seller_response TEXT,
  seller_responded_at TIMESTAMPTZ,
  resolution_notes TEXT,
  resolved_amount NUMERIC(12, 2),
  resolved_at TIMESTAMPTZ,
  sla_seller_deadline TIMESTAMPTZ,
  sla_admin_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_active_order
  ON disputes (order_id)
  WHERE status NOT IN (
    'resolved_buyer', 'resolved_seller', 'resolved_partial', 'withdrawn', 'closed'
  );

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_dispute
  FOREIGN KEY (dispute_id) REFERENCES disputes(id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitter_role TEXT NOT NULL CHECK (submitter_role IN ('buyer', 'seller', 'admin')),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN (
    'photo', 'document', 'tracking', 'message_thread', 'other'
  )),
  file_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute
  ON dispute_evidence (dispute_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('buyer', 'seller', 'admin')),
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute
  ON dispute_messages (dispute_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_disputes_status_created
  ON disputes (status, created_at DESC);

INSERT INTO platform_settings (key, value) VALUES
  ('seller_dispute_response_days', '3'),
  ('admin_dispute_review_days', '7')
ON CONFLICT (key) DO NOTHING;
