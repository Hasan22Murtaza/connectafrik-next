-- Global Sister Cities Partnership Hub (GSCH) — Phase 1
-- Additive only. Tables prefixed gsch_*.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL CHECK (
    org_type IN (
      'municipality',
      'government_agency',
      'business',
      'startup',
      'investor',
      'chamber_of_commerce',
      'university',
      'ngo',
      'tourism_board',
      'citizen'
    )
  ),
  country TEXT NOT NULL,
  state_province TEXT NULL,
  city TEXT NULL,
  website TEXT NULL,
  official_email TEXT NULL,
  description TEXT NULL,
  logo_url TEXT NULL,
  areas_of_interest TEXT[] NOT NULL DEFAULT '{}',
  verification_status TEXT NOT NULL DEFAULT 'draft' CHECK (
    verification_status IN (
      'draft',
      'submitted',
      'under_review',
      'additional_info_required',
      'verified',
      'rejected'
    )
  ),
  verification_badge TEXT NULL CHECK (
    verification_badge IS NULL OR verification_badge IN (
      'verified_city',
      'verified_business',
      'verified_institution',
      'verified_government',
      'strategic_global_partner'
    )
  ),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  verified_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  additional_info_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_orgs_created_by ON public.gsch_organizations (created_by);
CREATE INDEX IF NOT EXISTS idx_gsch_orgs_verification ON public.gsch_organizations (verification_status);
CREATE INDEX IF NOT EXISTS idx_gsch_orgs_country ON public.gsch_organizations (country);
CREATE INDEX IF NOT EXISTS idx_gsch_orgs_org_type ON public.gsch_organizations (org_type);

DROP TRIGGER IF EXISTS trg_gsch_organizations_updated_at ON public.gsch_organizations;
CREATE TRIGGER trg_gsch_organizations_updated_at
  BEFORE UPDATE ON public.gsch_organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'representative', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gsch_memberships_unique UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gsch_memberships_user ON public.gsch_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_gsch_memberships_org_status ON public.gsch_memberships (organization_id, status);

DROP TRIGGER IF EXISTS trg_gsch_memberships_updated_at ON public.gsch_memberships;
CREATE TRIGGER trg_gsch_memberships_updated_at
  BEFORE UPDATE ON public.gsch_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Verifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'submitted',
      'under_review',
      'additional_info_required',
      'verified',
      'rejected'
    )
  ),
  document_urls TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NULL,
  reviewer_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  admin_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_verifications_org ON public.gsch_verifications (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_verifications_status ON public.gsch_verifications (status);
CREATE INDEX IF NOT EXISTS idx_gsch_verifications_submitted_by ON public.gsch_verifications (submitted_by);

DROP TRIGGER IF EXISTS trg_gsch_verifications_updated_at ON public.gsch_verifications;
CREATE TRIGGER trg_gsch_verifications_updated_at
  BEFORE UPDATE ON public.gsch_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Cities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NULL REFERENCES public.gsch_organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  continent TEXT NULL,
  state_province TEXT NULL,
  logo_url TEXT NULL,
  cover_image_url TEXT NULL,
  description TEXT NULL,
  population BIGINT NULL,
  official_website TEXT NULL,
  mayor_name TEXT NULL,
  mayor_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  economic_info TEXT NULL,
  major_industries TEXT[] NOT NULL DEFAULT '{}',
  tourism_assets TEXT[] NOT NULL DEFAULT '{}',
  education_institutions TEXT[] NOT NULL DEFAULT '{}',
  infrastructure_priorities TEXT[] NOT NULL DEFAULT '{}',
  investment_opportunities TEXT NULL,
  renewable_energy_initiatives TEXT NULL,
  climate_objectives TEXT NULL,
  export_products TEXT[] NOT NULL DEFAULT '{}',
  collaboration_interests TEXT[] NOT NULL DEFAULT '{}',
  existing_sister_cities TEXT[] NOT NULL DEFAULT '{}',
  latitude NUMERIC NULL,
  longitude NUMERIC NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_cities_org ON public.gsch_cities (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_cities_created_by ON public.gsch_cities (created_by);
CREATE INDEX IF NOT EXISTS idx_gsch_cities_country ON public.gsch_cities (country);
CREATE INDEX IF NOT EXISTS idx_gsch_cities_continent ON public.gsch_cities (continent);
CREATE INDEX IF NOT EXISTS idx_gsch_cities_population ON public.gsch_cities (population);
CREATE INDEX IF NOT EXISTS idx_gsch_cities_published ON public.gsch_cities (is_published);
CREATE INDEX IF NOT EXISTS idx_gsch_cities_name ON public.gsch_cities (name);

DROP TRIGGER IF EXISTS trg_gsch_cities_updated_at ON public.gsch_cities;
CREATE TRIGGER trg_gsch_cities_updated_at
  BEFORE UPDATE ON public.gsch_cities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- City interests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_city_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.gsch_cities(id) ON DELETE CASCADE,
  interest_slug TEXT NOT NULL,
  interest_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gsch_city_interests_unique UNIQUE (city_id, interest_slug)
);

CREATE INDEX IF NOT EXISTS idx_gsch_city_interests_city ON public.gsch_city_interests (city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_city_interests_slug ON public.gsch_city_interests (interest_slug);

-- ---------------------------------------------------------------------------
-- City follows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_city_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.gsch_cities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gsch_city_follows_unique UNIQUE (city_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gsch_city_follows_user ON public.gsch_city_follows (user_id);
CREATE INDEX IF NOT EXISTS idx_gsch_city_follows_city ON public.gsch_city_follows (city_id);

-- ---------------------------------------------------------------------------
-- Audit logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_audit_logs_actor ON public.gsch_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_gsch_audit_logs_entity ON public.gsch_audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_gsch_audit_logs_created ON public.gsch_audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gsch_is_platform_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid
      AND p.platform_role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.gsch_is_org_member(
  org_id UUID,
  uid UUID DEFAULT auth.uid(),
  min_role TEXT DEFAULT 'member'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gsch_memberships m
    WHERE m.organization_id = org_id
      AND m.user_id = uid
      AND m.status = 'active'
      AND (
        CASE m.role
          WHEN 'owner' THEN 4
          WHEN 'admin' THEN 3
          WHEN 'representative' THEN 2
          WHEN 'member' THEN 1
          ELSE 0
        END
      ) >= (
        CASE min_role
          WHEN 'owner' THEN 4
          WHEN 'admin' THEN 3
          WHEN 'representative' THEN 2
          WHEN 'member' THEN 1
          ELSE 1
        END
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.gsch_can_manage_city(
  city_id UUID,
  uid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.gsch_is_platform_admin(uid)
    OR EXISTS (
      SELECT 1 FROM public.gsch_cities c
      WHERE c.id = city_id
        AND c.created_by = uid
    )
    OR EXISTS (
      SELECT 1
      FROM public.gsch_cities c
      JOIN public.gsch_memberships m ON m.organization_id = c.organization_id
      WHERE c.id = city_id
        AND c.organization_id IS NOT NULL
        AND m.user_id = uid
        AND m.status = 'active'
        AND m.role IN ('owner', 'admin', 'representative')
    );
$$;

-- Block non-platform-admins from verifying orgs or assigning badges.
-- Members may only move status to draft/submitted (via verification workflow).
CREATE OR REPLACE FUNCTION public.gsch_protect_org_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.gsch_is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.verification_badge IS DISTINCT FROM OLD.verification_badge THEN
    RAISE EXCEPTION 'Only platform admins can set verification badges';
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Only platform admins can set verification status to %', NEW.verification_status;
  END IF;
  IF NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'Only platform admins can set verification timestamps';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsch_protect_org_verification ON public.gsch_organizations;
CREATE TRIGGER trg_gsch_protect_org_verification
  BEFORE UPDATE ON public.gsch_organizations
  FOR EACH ROW EXECUTE FUNCTION public.gsch_protect_org_verification();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.gsch_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_city_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_city_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_audit_logs ENABLE ROW LEVEL SECURITY;

-- Organizations
DROP POLICY IF EXISTS gsch_orgs_select ON public.gsch_organizations;
CREATE POLICY gsch_orgs_select ON public.gsch_organizations
  FOR SELECT TO authenticated
  USING (
    verification_status = 'verified'
    OR created_by = auth.uid()
    OR public.gsch_is_org_member(id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_orgs_insert ON public.gsch_organizations;
CREATE POLICY gsch_orgs_insert ON public.gsch_organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS gsch_orgs_update ON public.gsch_organizations;
CREATE POLICY gsch_orgs_update ON public.gsch_organizations
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(id, auth.uid(), 'admin')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(id, auth.uid(), 'admin')
    OR public.gsch_is_platform_admin()
  );

-- Memberships
DROP POLICY IF EXISTS gsch_memberships_select ON public.gsch_memberships;
CREATE POLICY gsch_memberships_select ON public.gsch_memberships
  FOR SELECT TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_memberships_insert ON public.gsch_memberships;
CREATE POLICY gsch_memberships_insert ON public.gsch_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.gsch_is_platform_admin()
    OR public.gsch_is_org_member(organization_id, auth.uid(), 'admin')
    OR (
      role = 'owner'
      AND user_id = auth.uid()
      AND status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.gsch_organizations o
        WHERE o.id = organization_id
          AND o.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS gsch_memberships_update ON public.gsch_memberships;
CREATE POLICY gsch_memberships_update ON public.gsch_memberships
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'admin')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_id, auth.uid(), 'admin')
    OR public.gsch_is_platform_admin()
  );

-- Verifications
DROP POLICY IF EXISTS gsch_verifications_select ON public.gsch_verifications;
CREATE POLICY gsch_verifications_select ON public.gsch_verifications
  FOR SELECT TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR submitted_by = auth.uid()
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_verifications_insert ON public.gsch_verifications;
CREATE POLICY gsch_verifications_insert ON public.gsch_verifications
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_id, auth.uid(), 'member')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_verifications_update ON public.gsch_verifications;
CREATE POLICY gsch_verifications_update ON public.gsch_verifications
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_platform_admin()
    OR (
      submitted_by = auth.uid()
      AND status IN ('draft', 'additional_info_required')
    )
  )
  WITH CHECK (
    public.gsch_is_platform_admin()
    OR (
      submitted_by = auth.uid()
      AND status IN ('draft', 'submitted', 'additional_info_required')
    )
  );

-- Cities
DROP POLICY IF EXISTS gsch_cities_select ON public.gsch_cities;
CREATE POLICY gsch_cities_select ON public.gsch_cities
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.gsch_can_manage_city(id, auth.uid())
  );

DROP POLICY IF EXISTS gsch_cities_insert ON public.gsch_cities;
CREATE POLICY gsch_cities_insert ON public.gsch_cities
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_platform_admin()
      OR organization_id IS NULL
      OR public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    )
  );

DROP POLICY IF EXISTS gsch_cities_update ON public.gsch_cities;
CREATE POLICY gsch_cities_update ON public.gsch_cities
  FOR UPDATE TO authenticated
  USING (public.gsch_can_manage_city(id, auth.uid()))
  WITH CHECK (public.gsch_can_manage_city(id, auth.uid()));

-- City interests
DROP POLICY IF EXISTS gsch_city_interests_select ON public.gsch_city_interests;
CREATE POLICY gsch_city_interests_select ON public.gsch_city_interests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gsch_cities c
      WHERE c.id = city_id
        AND (c.is_published = true OR public.gsch_can_manage_city(c.id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS gsch_city_interests_insert ON public.gsch_city_interests;
CREATE POLICY gsch_city_interests_insert ON public.gsch_city_interests
  FOR INSERT TO authenticated
  WITH CHECK (public.gsch_can_manage_city(city_id, auth.uid()));

DROP POLICY IF EXISTS gsch_city_interests_update ON public.gsch_city_interests;
CREATE POLICY gsch_city_interests_update ON public.gsch_city_interests
  FOR UPDATE TO authenticated
  USING (public.gsch_can_manage_city(city_id, auth.uid()))
  WITH CHECK (public.gsch_can_manage_city(city_id, auth.uid()));

DROP POLICY IF EXISTS gsch_city_interests_delete ON public.gsch_city_interests;
CREATE POLICY gsch_city_interests_delete ON public.gsch_city_interests
  FOR DELETE TO authenticated
  USING (public.gsch_can_manage_city(city_id, auth.uid()));

-- City follows
DROP POLICY IF EXISTS gsch_city_follows_select ON public.gsch_city_follows;
CREATE POLICY gsch_city_follows_select ON public.gsch_city_follows
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.gsch_is_platform_admin());

DROP POLICY IF EXISTS gsch_city_follows_insert ON public.gsch_city_follows;
CREATE POLICY gsch_city_follows_insert ON public.gsch_city_follows
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS gsch_city_follows_delete ON public.gsch_city_follows;
CREATE POLICY gsch_city_follows_delete ON public.gsch_city_follows
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Audit logs
DROP POLICY IF EXISTS gsch_audit_select ON public.gsch_audit_logs;
CREATE POLICY gsch_audit_select ON public.gsch_audit_logs
  FOR SELECT TO authenticated
  USING (public.gsch_is_platform_admin());

DROP POLICY IF EXISTS gsch_audit_insert ON public.gsch_audit_logs;
CREATE POLICY gsch_audit_insert ON public.gsch_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.gsch_is_platform_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.gsch_organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_verifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_cities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gsch_city_interests TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.gsch_city_follows TO authenticated;
GRANT SELECT, INSERT ON public.gsch_audit_logs TO authenticated;

GRANT ALL ON public.gsch_organizations TO service_role;
GRANT ALL ON public.gsch_memberships TO service_role;
GRANT ALL ON public.gsch_verifications TO service_role;
GRANT ALL ON public.gsch_cities TO service_role;
GRANT ALL ON public.gsch_city_interests TO service_role;
GRANT ALL ON public.gsch_city_follows TO service_role;
GRANT ALL ON public.gsch_audit_logs TO service_role;

-- ---------------------------------------------------------------------------
-- Extend notifications type check
-- Copy ALL types from youth migration PLUS family extras PLUS gsch types
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
      'gsch_city_follow'
    )
  );
