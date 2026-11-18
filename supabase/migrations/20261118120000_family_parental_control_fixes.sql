-- Parental control fixes: member role, teen oversight opt-in, age milestones, parent verifications.

-- ---------------------------------------------------------------------------
-- Roles: add 'member'
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_members DROP CONSTRAINT IF EXISTS family_members_role_check;
ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_role_check
  CHECK (role IN ('parent', 'child', 'teen', 'member'));

ALTER TABLE public.family_invitations DROP CONSTRAINT IF EXISTS family_invitations_role_check;
ALTER TABLE public.family_invitations
  ADD CONSTRAINT family_invitations_role_check
  CHECK (role IN ('parent', 'child', 'teen', 'member'));

-- ---------------------------------------------------------------------------
-- Teen opt-in for parental oversight (children are always managed regardless)
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS parental_oversight_enabled BOOLEAN NOT NULL DEFAULT false;

UPDATE public.family_members
SET parental_oversight_enabled = true
WHERE role = 'child' AND parental_oversight_enabled IS DISTINCT FROM true;

UPDATE public.family_members
SET parental_oversight_enabled = false
WHERE role = 'teen' AND parental_oversight_enabled IS DISTINCT FROM false;

-- ---------------------------------------------------------------------------
-- Age milestone tracking (16 notice / 18 auto-promote)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_age_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL CHECK (milestone IN ('turned_16', 'turned_18')),
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_member_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_family_age_milestones_member
  ON public.family_age_milestones (family_member_id);

-- ---------------------------------------------------------------------------
-- Parent verification requests (birthday change / child removal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('birthday_change', 'child_removal')),
  requester_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')
  ),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_verification_token_hash
  ON public.family_verification_requests (token_hash);

CREATE INDEX IF NOT EXISTS idx_family_verification_pending
  ON public.family_verification_requests (status, expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_family_verification_target
  ON public.family_verification_requests (target_member_id, type, status);

ALTER TABLE public.family_age_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_verification_requests ENABLE ROW LEVEL SECURITY;
