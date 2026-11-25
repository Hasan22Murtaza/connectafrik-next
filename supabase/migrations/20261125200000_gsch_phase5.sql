-- Global Sister Cities Partnership Hub (GSCH) — Phase 5 (final)
-- Additive only. Agreements, events, analytics support columns, org tiers.
-- Reuses set_updated_at, gsch_is_platform_admin, gsch_is_org_member.

-- ---------------------------------------------------------------------------
-- Organization subscription tiers (admin-assignable; no payments)
-- ---------------------------------------------------------------------------
ALTER TABLE public.gsch_organizations
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';

ALTER TABLE public.gsch_organizations
  DROP CONSTRAINT IF EXISTS gsch_organizations_subscription_tier_check;

ALTER TABLE public.gsch_organizations
  ADD CONSTRAINT gsch_organizations_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'standard', 'enterprise'));

ALTER TABLE public.gsch_organizations
  ADD COLUMN IF NOT EXISTS subscription_notes TEXT NULL;

ALTER TABLE public.gsch_organizations
  ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMPTZ NULL;

ALTER TABLE public.gsch_organizations
  ADD COLUMN IF NOT EXISTS subscription_updated_by UUID NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gsch_organizations_subscription_tier
  ON public.gsch_organizations (subscription_tier);

-- Only platform admin / service_role may change subscription fields.
CREATE OR REPLACE FUNCTION public.gsch_protect_org_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.gsch_is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.subscription_notes IS DISTINCT FROM OLD.subscription_notes
     OR NEW.subscription_updated_at IS DISTINCT FROM OLD.subscription_updated_at
     OR NEW.subscription_updated_by IS DISTINCT FROM OLD.subscription_updated_by THEN
    RAISE EXCEPTION 'Only platform admins can change organization subscription tiers';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsch_protect_org_subscription ON public.gsch_organizations;
CREATE TRIGGER trg_gsch_protect_org_subscription
  BEFORE UPDATE ON public.gsch_organizations
  FOR EACH ROW EXECUTE FUNCTION public.gsch_protect_org_subscription();

-- ---------------------------------------------------------------------------
-- Agreements (intent recording only — NOT legal e-sign)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NULL REFERENCES public.gsch_partnerships(id) ON DELETE SET NULL,
  template_type TEXT NOT NULL CHECK (
    template_type IN (
      'sister_city',
      'economic',
      'tourism',
      'education',
      'climate',
      'custom'
    )
  ),
  title TEXT NOT NULL,
  organization_a_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  organization_b_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  city_a_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  city_b_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  objectives TEXT NULL,
  duration_label TEXT NULL,
  responsibilities_a TEXT NULL,
  responsibilities_b TEXT NULL,
  document_urls TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'submitted',
      'discussion',
      'approved',
      'signed',
      'active',
      'completed',
      'cancelled'
    )
  ),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gsch_agreements_orgs_distinct CHECK (organization_a_id <> organization_b_id)
);

CREATE INDEX IF NOT EXISTS idx_gsch_agreements_org_a
  ON public.gsch_agreements (organization_a_id);
CREATE INDEX IF NOT EXISTS idx_gsch_agreements_org_b
  ON public.gsch_agreements (organization_b_id);
CREATE INDEX IF NOT EXISTS idx_gsch_agreements_status
  ON public.gsch_agreements (status);
CREATE INDEX IF NOT EXISTS idx_gsch_agreements_partnership
  ON public.gsch_agreements (partnership_id);
CREATE INDEX IF NOT EXISTS idx_gsch_agreements_created
  ON public.gsch_agreements (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_agreements_updated_at ON public.gsch_agreements;
CREATE TRIGGER trg_gsch_agreements_updated_at
  BEFORE UPDATE ON public.gsch_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Agreement milestones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_agreement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.gsch_agreements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NULL,
  due_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'done', 'skipped')
  ),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_agreement_milestones_agreement
  ON public.gsch_agreement_milestones (agreement_id, sort_order);

DROP TRIGGER IF EXISTS trg_gsch_agreement_milestones_updated_at
  ON public.gsch_agreement_milestones;
CREATE TRIGGER trg_gsch_agreement_milestones_updated_at
  BEFORE UPDATE ON public.gsch_agreement_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Agreement approvals / intent log
-- signed_intent is NOT a legally binding electronic signature.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_agreement_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.gsch_agreements(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  approver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (
    action IN ('submitted', 'approved', 'rejected', 'comment', 'signed_intent')
  ),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gsch_agreement_approvals IS
  'Agreement workflow actions. signed_intent is NOT a legally binding electronic signature.';

COMMENT ON COLUMN public.gsch_agreement_approvals.action IS
  'signed_intent is NOT a legally binding electronic signature.';

CREATE INDEX IF NOT EXISTS idx_gsch_agreement_approvals_agreement
  ON public.gsch_agreement_approvals (agreement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsch_agreement_approvals_org
  ON public.gsch_agreement_approvals (organization_id);

-- ---------------------------------------------------------------------------
-- Global events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  city_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  description TEXT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'conference',
      'trade_mission',
      'workshop',
      'summit',
      'cultural',
      'networking',
      'other'
    )
  ),
  country TEXT NULL,
  continent TEXT NULL,
  location_label TEXT NULL,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  external_url TEXT NULL,
  contact_email TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_events_org
  ON public.gsch_events (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_events_city
  ON public.gsch_events (city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_events_type
  ON public.gsch_events (event_type);
CREATE INDEX IF NOT EXISTS idx_gsch_events_published
  ON public.gsch_events (is_published);
CREATE INDEX IF NOT EXISTS idx_gsch_events_starts
  ON public.gsch_events (starts_at);
CREATE INDEX IF NOT EXISTS idx_gsch_events_created
  ON public.gsch_events (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_events_updated_at ON public.gsch_events;
CREATE TRIGGER trg_gsch_events_updated_at
  BEFORE UPDATE ON public.gsch_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Event registrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.gsch_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NULL REFERENCES public.gsch_organizations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (
    status IN ('registered', 'cancelled', 'attended')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gsch_event_registrations_event
  ON public.gsch_event_registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_gsch_event_registrations_user
  ON public.gsch_event_registrations (user_id);

DROP TRIGGER IF EXISTS trg_gsch_event_registrations_updated_at
  ON public.gsch_event_registrations;
CREATE TRIGGER trg_gsch_event_registrations_updated_at
  BEFORE UPDATE ON public.gsch_event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.gsch_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_agreement_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_agreement_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_event_registrations ENABLE ROW LEVEL SECURITY;

-- Agreements: readable by members of either org or platform admin
DROP POLICY IF EXISTS gsch_agreements_select ON public.gsch_agreements;
CREATE POLICY gsch_agreements_select ON public.gsch_agreements
  FOR SELECT TO authenticated
  USING (
    public.gsch_is_org_member(organization_a_id, auth.uid(), 'member')
    OR public.gsch_is_org_member(organization_b_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_agreements_insert ON public.gsch_agreements;
CREATE POLICY gsch_agreements_insert ON public.gsch_agreements
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_a_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_agreements_update ON public.gsch_agreements;
CREATE POLICY gsch_agreements_update ON public.gsch_agreements
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_a_id, auth.uid(), 'representative')
    OR public.gsch_is_org_member(organization_b_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_a_id, auth.uid(), 'representative')
    OR public.gsch_is_org_member(organization_b_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- Milestones: same visibility as agreement; write by org reps
DROP POLICY IF EXISTS gsch_agreement_milestones_select ON public.gsch_agreement_milestones;
CREATE POLICY gsch_agreement_milestones_select ON public.gsch_agreement_milestones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gsch_agreements a
      WHERE a.id = agreement_id
        AND (
          public.gsch_is_org_member(a.organization_a_id, auth.uid(), 'member')
          OR public.gsch_is_org_member(a.organization_b_id, auth.uid(), 'member')
          OR public.gsch_is_platform_admin()
        )
    )
  );

DROP POLICY IF EXISTS gsch_agreement_milestones_insert ON public.gsch_agreement_milestones;
CREATE POLICY gsch_agreement_milestones_insert ON public.gsch_agreement_milestones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gsch_agreements a
      WHERE a.id = agreement_id
        AND (
          public.gsch_is_org_member(a.organization_a_id, auth.uid(), 'representative')
          OR public.gsch_is_org_member(a.organization_b_id, auth.uid(), 'representative')
          OR public.gsch_is_platform_admin()
        )
    )
  );

DROP POLICY IF EXISTS gsch_agreement_milestones_update ON public.gsch_agreement_milestones;
CREATE POLICY gsch_agreement_milestones_update ON public.gsch_agreement_milestones
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gsch_agreements a
      WHERE a.id = agreement_id
        AND (
          public.gsch_is_org_member(a.organization_a_id, auth.uid(), 'representative')
          OR public.gsch_is_org_member(a.organization_b_id, auth.uid(), 'representative')
          OR public.gsch_is_platform_admin()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gsch_agreements a
      WHERE a.id = agreement_id
        AND (
          public.gsch_is_org_member(a.organization_a_id, auth.uid(), 'representative')
          OR public.gsch_is_org_member(a.organization_b_id, auth.uid(), 'representative')
          OR public.gsch_is_platform_admin()
        )
    )
  );

-- Approvals: readable like agreement; insert by org members
DROP POLICY IF EXISTS gsch_agreement_approvals_select ON public.gsch_agreement_approvals;
CREATE POLICY gsch_agreement_approvals_select ON public.gsch_agreement_approvals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gsch_agreements a
      WHERE a.id = agreement_id
        AND (
          public.gsch_is_org_member(a.organization_a_id, auth.uid(), 'member')
          OR public.gsch_is_org_member(a.organization_b_id, auth.uid(), 'member')
          OR public.gsch_is_platform_admin()
        )
    )
  );

DROP POLICY IF EXISTS gsch_agreement_approvals_insert ON public.gsch_agreement_approvals;
CREATE POLICY gsch_agreement_approvals_insert ON public.gsch_agreement_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    approver_user_id = auth.uid()
    AND public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    AND EXISTS (
      SELECT 1 FROM public.gsch_agreements a
      WHERE a.id = agreement_id
        AND (
          a.organization_a_id = organization_id
          OR a.organization_b_id = organization_id
        )
    )
  );

-- Events: like opportunities
DROP POLICY IF EXISTS gsch_events_select ON public.gsch_events;
CREATE POLICY gsch_events_select ON public.gsch_events
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_events_insert ON public.gsch_events;
CREATE POLICY gsch_events_insert ON public.gsch_events
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_events_update ON public.gsch_events;
CREATE POLICY gsch_events_update ON public.gsch_events
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- Registrations: user self + event org read
DROP POLICY IF EXISTS gsch_event_registrations_select ON public.gsch_event_registrations;
CREATE POLICY gsch_event_registrations_select ON public.gsch_event_registrations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_events e
      WHERE e.id = event_id
        AND public.gsch_is_org_member(e.organization_id, auth.uid(), 'member')
    )
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_event_registrations_insert ON public.gsch_event_registrations;
CREATE POLICY gsch_event_registrations_insert ON public.gsch_event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS gsch_event_registrations_update ON public.gsch_event_registrations;
CREATE POLICY gsch_event_registrations_update ON public.gsch_event_registrations
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_events e
      WHERE e.id = event_id
        AND public.gsch_is_org_member(e.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_events e
      WHERE e.id = event_id
        AND public.gsch_is_org_member(e.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.gsch_agreements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_agreement_milestones TO authenticated;
GRANT SELECT, INSERT ON public.gsch_agreement_approvals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_event_registrations TO authenticated;

GRANT ALL ON public.gsch_agreements TO service_role;
GRANT ALL ON public.gsch_agreement_milestones TO service_role;
GRANT ALL ON public.gsch_agreement_approvals TO service_role;
GRANT ALL ON public.gsch_events TO service_role;
GRANT ALL ON public.gsch_event_registrations TO service_role;

-- ---------------------------------------------------------------------------
-- Extend notifications type check (Phase 1–4 types + Phase 5)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'like',
      'new_order',
      'system',
      'post_like',
      'post_comment',
      'post_comment_like',
      'post_create',
      'post_share',
      'post_reaction',
      'comment',
      'comment_reply',
      'comment_like',
      'comment_reaction',
      'reel_like',
      'reel_comment',
      'reel_create',
      'reel_share',
      'reel_comment_like',
      'follow',
      'unfollow',
      'mention',
      'friend_request',
      'friend_request_accepted',
      'friend_request_confirmed',
      'friend_request_declined',
      'group_join_request',
      'group_join_approved',
      'group_join_rejected',
      'group_invite',
      'chat_message',
      'call',
      'initiated',
      'ringing',
      'active',
      'ended',
      'declined',
      'missed',
      'failed',
      'birthday',
      'family_invite',
      'family_invite_accepted',
      'family_controls_updated',
      'family_screen_time_updated',
      'family_screen_time_limit',
      'family_safety_alert',
      'family_friend_request_approved',
      'family_child_turned_16',
      'family_verification_required',
      'youth_program_application',
      'youth_application_status',
      'youth_program_accepted',
      'youth_program_completed',
      'youth_mentorship_request',
      'youth_mentorship_accepted',
      'youth_project_invitation',
      'youth_project_task',
      'youth_event_reminder',
      'youth_achievement_verified',
      'youth_certificate_issued',
      'youth_guardian_approval',
      'gsch_verification_submitted',
      'gsch_verification_status',
      'gsch_org_invite',
      'gsch_city_follow',
      'gsch_partnership_request',
      'gsch_partnership_response',
      'gsch_opportunity_published',
      'gsch_match_ready',
      'gsch_project_interest',
      'gsch_project_info_request',
      'gsch_trade_enquiry',
      'gsch_trade_enquiry_response',
      'gsch_education_application',
      'gsch_tourism_partnership',
      'gsch_innovation_submission',
      'gsch_climate_interest',
      'gsch_agreement_update',
      'gsch_event_published',
      'gsch_event_registration'
    )
  );
