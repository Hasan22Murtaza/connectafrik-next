-- Global Sister Cities Partnership Hub (GSCH) — Phase 2
-- Additive only. Partnerships, match recommendations, opportunities.

-- ---------------------------------------------------------------------------
-- Partnership requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_partnership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  target_organization_id UUID NULL REFERENCES public.gsch_organizations(id) ON DELETE SET NULL,
  requesting_city_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  target_city_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  partnership_type TEXT NOT NULL CHECK (
    partnership_type IN (
      'sister_city',
      'economic',
      'tourism',
      'education',
      'climate',
      'infrastructure',
      'innovation',
      'cultural',
      'other'
    )
  ),
  objectives TEXT NULL,
  proposed_duration TEXT NULL,
  message TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('draft', 'pending', 'accepted', 'declined', 'withdrawn', 'cancelled')
  ),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  responded_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ NULL,
  response_notes TEXT NULL,
  partnership_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gsch_partnership_requests_target_required CHECK (
    target_organization_id IS NOT NULL OR target_city_id IS NOT NULL
  ),
  CONSTRAINT gsch_partnership_requests_orgs_distinct CHECK (
    requesting_organization_id <> target_organization_id
    OR target_organization_id IS NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_gsch_partnership_requests_status
  ON public.gsch_partnership_requests (status);
CREATE INDEX IF NOT EXISTS idx_gsch_partnership_requests_requesting_org
  ON public.gsch_partnership_requests (requesting_organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_partnership_requests_target_org
  ON public.gsch_partnership_requests (target_organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_partnership_requests_requesting_city
  ON public.gsch_partnership_requests (requesting_city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_partnership_requests_target_city
  ON public.gsch_partnership_requests (target_city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_partnership_requests_created_by
  ON public.gsch_partnership_requests (created_by);

DROP TRIGGER IF EXISTS trg_gsch_partnership_requests_updated_at ON public.gsch_partnership_requests;
CREATE TRIGGER trg_gsch_partnership_requests_updated_at
  BEFORE UPDATE ON public.gsch_partnership_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Active partnerships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NULL REFERENCES public.gsch_partnership_requests(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  partnership_type TEXT NOT NULL CHECK (
    partnership_type IN (
      'sister_city',
      'economic',
      'tourism',
      'education',
      'climate',
      'infrastructure',
      'innovation',
      'cultural',
      'other'
    )
  ),
  organization_a_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  organization_b_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  city_a_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  city_b_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  objectives TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'paused', 'completed', 'cancelled')
  ),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gsch_partnerships_orgs_distinct CHECK (
    organization_a_id <> organization_b_id
  )
);

CREATE INDEX IF NOT EXISTS idx_gsch_partnerships_status
  ON public.gsch_partnerships (status);
CREATE INDEX IF NOT EXISTS idx_gsch_partnerships_org_a
  ON public.gsch_partnerships (organization_a_id);
CREATE INDEX IF NOT EXISTS idx_gsch_partnerships_org_b
  ON public.gsch_partnerships (organization_b_id);
CREATE INDEX IF NOT EXISTS idx_gsch_partnerships_city_a
  ON public.gsch_partnerships (city_a_id);
CREATE INDEX IF NOT EXISTS idx_gsch_partnerships_city_b
  ON public.gsch_partnerships (city_b_id);
CREATE INDEX IF NOT EXISTS idx_gsch_partnerships_request
  ON public.gsch_partnerships (request_id);

DROP TRIGGER IF EXISTS trg_gsch_partnerships_updated_at ON public.gsch_partnerships;
CREATE TRIGGER trg_gsch_partnerships_updated_at
  BEFORE UPDATE ON public.gsch_partnerships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Back-reference from request → partnership (circular FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gsch_partnership_requests_partnership_id_fkey'
  ) THEN
    ALTER TABLE public.gsch_partnership_requests
      ADD CONSTRAINT gsch_partnership_requests_partnership_id_fkey
      FOREIGN KEY (partnership_id) REFERENCES public.gsch_partnerships(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Match recommendations (cached weighted_v1 scores)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_match_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_city_id UUID NOT NULL REFERENCES public.gsch_cities(id) ON DELETE CASCADE,
  recommended_city_id UUID NOT NULL REFERENCES public.gsch_cities(id) ON DELETE CASCADE,
  compatibility_score NUMERIC(5, 2) NOT NULL CHECK (
    compatibility_score >= 0 AND compatibility_score <= 100
  ),
  shared_interests TEXT[] NOT NULL DEFAULT '{}',
  collaboration_areas TEXT[] NOT NULL DEFAULT '{}',
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation TEXT NOT NULL,
  algorithm_version TEXT NOT NULL DEFAULT 'weighted_v1',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gsch_match_recommendations_unique
    UNIQUE (source_city_id, recommended_city_id, algorithm_version),
  CONSTRAINT gsch_match_recommendations_distinct_cities CHECK (
    source_city_id <> recommended_city_id
  )
);

CREATE INDEX IF NOT EXISTS idx_gsch_match_source
  ON public.gsch_match_recommendations (source_city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_match_recommended
  ON public.gsch_match_recommendations (recommended_city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_match_computed_at
  ON public.gsch_match_recommendations (computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gsch_match_score
  ON public.gsch_match_recommendations (compatibility_score DESC);

-- ---------------------------------------------------------------------------
-- Global opportunities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  city_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  description TEXT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'investment',
      'grant',
      'conference',
      'trade_mission',
      'development_funding',
      'innovation_challenge',
      'sister_city',
      'education_program',
      'other'
    )
  ),
  country TEXT NULL,
  continent TEXT NULL,
  location_label TEXT NULL,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  application_deadline TIMESTAMPTZ NULL,
  external_url TEXT NULL,
  contact_email TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_opportunities_org
  ON public.gsch_opportunities (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_opportunities_city
  ON public.gsch_opportunities (city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_opportunities_category
  ON public.gsch_opportunities (category);
CREATE INDEX IF NOT EXISTS idx_gsch_opportunities_published
  ON public.gsch_opportunities (is_published);
CREATE INDEX IF NOT EXISTS idx_gsch_opportunities_country
  ON public.gsch_opportunities (country);
CREATE INDEX IF NOT EXISTS idx_gsch_opportunities_created
  ON public.gsch_opportunities (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_opportunities_updated_at ON public.gsch_opportunities;
CREATE TRIGGER trg_gsch_opportunities_updated_at
  BEFORE UPDATE ON public.gsch_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.gsch_partnership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_match_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_opportunities ENABLE ROW LEVEL SECURITY;

-- Partnership requests
DROP POLICY IF EXISTS gsch_partnership_requests_select ON public.gsch_partnership_requests;
CREATE POLICY gsch_partnership_requests_select ON public.gsch_partnership_requests
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.gsch_is_org_member(requesting_organization_id, auth.uid(), 'member')
    OR (
      target_organization_id IS NOT NULL
      AND public.gsch_is_org_member(target_organization_id, auth.uid(), 'member')
    )
    OR (
      target_city_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.gsch_cities c
        WHERE c.id = target_city_id
          AND c.organization_id IS NOT NULL
          AND public.gsch_is_org_member(c.organization_id, auth.uid(), 'member')
      )
    )
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_partnership_requests_insert ON public.gsch_partnership_requests;
CREATE POLICY gsch_partnership_requests_insert ON public.gsch_partnership_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(requesting_organization_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_partnership_requests_update ON public.gsch_partnership_requests;
CREATE POLICY gsch_partnership_requests_update ON public.gsch_partnership_requests
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.gsch_is_org_member(requesting_organization_id, auth.uid(), 'admin')
    OR (
      target_organization_id IS NOT NULL
      AND public.gsch_is_org_member(target_organization_id, auth.uid(), 'representative')
    )
    OR (
      target_city_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.gsch_cities c
        WHERE c.id = target_city_id
          AND c.organization_id IS NOT NULL
          AND public.gsch_is_org_member(c.organization_id, auth.uid(), 'representative')
      )
    )
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.gsch_is_org_member(requesting_organization_id, auth.uid(), 'admin')
    OR (
      target_organization_id IS NOT NULL
      AND public.gsch_is_org_member(target_organization_id, auth.uid(), 'representative')
    )
    OR (
      target_city_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.gsch_cities c
        WHERE c.id = target_city_id
          AND c.organization_id IS NOT NULL
          AND public.gsch_is_org_member(c.organization_id, auth.uid(), 'representative')
      )
    )
    OR public.gsch_is_platform_admin()
  );

-- Partnerships: authenticated may read active; members/admin see all theirs
DROP POLICY IF EXISTS gsch_partnerships_select ON public.gsch_partnerships;
CREATE POLICY gsch_partnerships_select ON public.gsch_partnerships
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR public.gsch_is_org_member(organization_a_id, auth.uid(), 'member')
    OR public.gsch_is_org_member(organization_b_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

-- Allow INSERT for members of either org so accept (target) and request flows work
DROP POLICY IF EXISTS gsch_partnerships_insert ON public.gsch_partnerships;
CREATE POLICY gsch_partnerships_insert ON public.gsch_partnerships
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_a_id, auth.uid(), 'member')
      OR public.gsch_is_org_member(organization_b_id, auth.uid(), 'member')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_partnerships_update ON public.gsch_partnerships;
CREATE POLICY gsch_partnerships_update ON public.gsch_partnerships
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_a_id, auth.uid(), 'admin')
    OR public.gsch_is_org_member(organization_b_id, auth.uid(), 'admin')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_a_id, auth.uid(), 'admin')
    OR public.gsch_is_org_member(organization_b_id, auth.uid(), 'admin')
    OR public.gsch_is_platform_admin()
  );

-- Match recommendations
DROP POLICY IF EXISTS gsch_match_recommendations_select ON public.gsch_match_recommendations;
CREATE POLICY gsch_match_recommendations_select ON public.gsch_match_recommendations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS gsch_match_recommendations_insert ON public.gsch_match_recommendations;
CREATE POLICY gsch_match_recommendations_insert ON public.gsch_match_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.gsch_is_platform_admin()
    OR public.gsch_can_manage_city(source_city_id, auth.uid())
  );

DROP POLICY IF EXISTS gsch_match_recommendations_update ON public.gsch_match_recommendations;
CREATE POLICY gsch_match_recommendations_update ON public.gsch_match_recommendations
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_platform_admin()
    OR public.gsch_can_manage_city(source_city_id, auth.uid())
  )
  WITH CHECK (
    public.gsch_is_platform_admin()
    OR public.gsch_can_manage_city(source_city_id, auth.uid())
  );

DROP POLICY IF EXISTS gsch_match_recommendations_delete ON public.gsch_match_recommendations;
CREATE POLICY gsch_match_recommendations_delete ON public.gsch_match_recommendations
  FOR DELETE TO authenticated
  USING (
    public.gsch_is_platform_admin()
    OR public.gsch_can_manage_city(source_city_id, auth.uid())
  );

-- Opportunities
DROP POLICY IF EXISTS gsch_opportunities_select ON public.gsch_opportunities;
CREATE POLICY gsch_opportunities_select ON public.gsch_opportunities
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_opportunities_insert ON public.gsch_opportunities;
CREATE POLICY gsch_opportunities_insert ON public.gsch_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_opportunities_update ON public.gsch_opportunities;
CREATE POLICY gsch_opportunities_update ON public.gsch_opportunities
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.gsch_partnership_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_partnerships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsch_match_recommendations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_opportunities TO authenticated;

GRANT ALL ON public.gsch_partnership_requests TO service_role;
GRANT ALL ON public.gsch_partnerships TO service_role;
GRANT ALL ON public.gsch_match_recommendations TO service_role;
GRANT ALL ON public.gsch_opportunities TO service_role;

-- ---------------------------------------------------------------------------
-- Extend notifications type check (Phase 1 types + Phase 2)
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
      'gsch_match_ready'
    )
  );
