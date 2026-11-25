-- Global Sister Cities Partnership Hub (GSCH) — Phase 3
-- Additive only. Investment marketplace + business connection centre.
-- Reuses set_updated_at, gsch_is_platform_admin, gsch_is_org_member.

-- ---------------------------------------------------------------------------
-- Investment projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  city_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'renewable_energy',
      'infrastructure',
      'real_estate',
      'transportation',
      'agriculture',
      'manufacturing',
      'technology',
      'tourism',
      'water_management'
    )
  ),
  location_label TEXT NULL,
  country TEXT NULL,
  continent TEXT NULL,
  estimated_value_amount NUMERIC NULL,
  estimated_value_currency TEXT NULL DEFAULT 'USD',
  funding_required_amount NUMERIC NULL,
  funding_required_currency TEXT NULL DEFAULT 'USD',
  investment_structure TEXT NULL,
  project_stage TEXT NOT NULL DEFAULT 'concept' CHECK (
    project_stage IN (
      'concept',
      'feasibility',
      'development',
      'funding',
      'construction',
      'operational',
      'completed'
    )
  ),
  required_partners TEXT[] NOT NULL DEFAULT '{}',
  document_urls TEXT[] NOT NULL DEFAULT '{}',
  contact_email TEXT NULL,
  contact_name TEXT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (
    verification_status IN ('unverified', 'pending_review', 'verified', 'rejected')
  ),
  is_published BOOLEAN NOT NULL DEFAULT false,
  disclaimer_acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_projects_org
  ON public.gsch_projects (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_projects_city
  ON public.gsch_projects (city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_projects_category
  ON public.gsch_projects (category);
CREATE INDEX IF NOT EXISTS idx_gsch_projects_published
  ON public.gsch_projects (is_published);
CREATE INDEX IF NOT EXISTS idx_gsch_projects_verification
  ON public.gsch_projects (verification_status);
CREATE INDEX IF NOT EXISTS idx_gsch_projects_country
  ON public.gsch_projects (country);
CREATE INDEX IF NOT EXISTS idx_gsch_projects_stage
  ON public.gsch_projects (project_stage);
CREATE INDEX IF NOT EXISTS idx_gsch_projects_created
  ON public.gsch_projects (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_projects_updated_at ON public.gsch_projects;
CREATE TRIGGER trg_gsch_projects_updated_at
  BEFORE UPDATE ON public.gsch_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Project saves
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_project_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.gsch_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gsch_project_saves_unique UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gsch_project_saves_user
  ON public.gsch_project_saves (user_id);
CREATE INDEX IF NOT EXISTS idx_gsch_project_saves_project
  ON public.gsch_project_saves (project_id);

-- ---------------------------------------------------------------------------
-- Project applications (express interest / request info — NOT payments)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_project_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.gsch_projects(id) ON DELETE CASCADE,
  organization_id UUID NULL REFERENCES public.gsch_organizations(id) ON DELETE SET NULL,
  applicant_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  application_type TEXT NOT NULL CHECK (
    application_type IN ('express_interest', 'request_information')
  ),
  message TEXT NULL,
  contact_email TEXT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'under_review', 'responded', 'withdrawn', 'closed')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_project_applications_project
  ON public.gsch_project_applications (project_id);
CREATE INDEX IF NOT EXISTS idx_gsch_project_applications_org
  ON public.gsch_project_applications (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_project_applications_applicant
  ON public.gsch_project_applications (applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_gsch_project_applications_status
  ON public.gsch_project_applications (status);

DROP TRIGGER IF EXISTS trg_gsch_project_applications_updated_at ON public.gsch_project_applications;
CREATE TRIGGER trg_gsch_project_applications_updated_at
  BEFORE UPDATE ON public.gsch_project_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Business profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  tagline TEXT NULL,
  description TEXT NULL,
  logo_url TEXT NULL,
  website TEXT NULL,
  country TEXT NULL,
  city TEXT NULL,
  industry_sectors TEXT[] NOT NULL DEFAULT '{}',
  seeking TEXT[] NOT NULL DEFAULT '{}',
  offering TEXT[] NOT NULL DEFAULT '{}',
  export_markets TEXT[] NOT NULL DEFAULT '{}',
  import_needs TEXT[] NOT NULL DEFAULT '{}',
  languages TEXT[] NOT NULL DEFAULT '{}',
  employee_range TEXT NULL,
  year_established INT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_business_profiles_org
  ON public.gsch_business_profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_business_profiles_published
  ON public.gsch_business_profiles (is_published);
CREATE INDEX IF NOT EXISTS idx_gsch_business_profiles_country
  ON public.gsch_business_profiles (country);
CREATE INDEX IF NOT EXISTS idx_gsch_business_profiles_seeking
  ON public.gsch_business_profiles USING GIN (seeking);
CREATE INDEX IF NOT EXISTS idx_gsch_business_profiles_offering
  ON public.gsch_business_profiles USING GIN (offering);
CREATE INDEX IF NOT EXISTS idx_gsch_business_profiles_sectors
  ON public.gsch_business_profiles USING GIN (industry_sectors);
CREATE INDEX IF NOT EXISTS idx_gsch_business_profiles_created
  ON public.gsch_business_profiles (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_business_profiles_updated_at ON public.gsch_business_profiles;
CREATE TRIGGER trg_gsch_business_profiles_updated_at
  BEFORE UPDATE ON public.gsch_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Trade enquiries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_trade_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  to_organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  to_business_profile_id UUID NULL REFERENCES public.gsch_business_profiles(id) ON DELETE SET NULL,
  enquiry_type TEXT NOT NULL CHECK (
    enquiry_type IN (
      'buyer',
      'supplier',
      'distributor',
      'export',
      'import',
      'partnership',
      'general'
    )
  ),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'responded', 'closed', 'withdrawn')
  ),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  responded_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ NULL,
  response_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gsch_trade_enquiries_orgs_distinct CHECK (
    from_organization_id <> to_organization_id
  )
);

CREATE INDEX IF NOT EXISTS idx_gsch_trade_enquiries_from
  ON public.gsch_trade_enquiries (from_organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_trade_enquiries_to
  ON public.gsch_trade_enquiries (to_organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_trade_enquiries_profile
  ON public.gsch_trade_enquiries (to_business_profile_id);
CREATE INDEX IF NOT EXISTS idx_gsch_trade_enquiries_status
  ON public.gsch_trade_enquiries (status);
CREATE INDEX IF NOT EXISTS idx_gsch_trade_enquiries_created
  ON public.gsch_trade_enquiries (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_trade_enquiries_updated_at ON public.gsch_trade_enquiries;
CREATE TRIGGER trg_gsch_trade_enquiries_updated_at
  BEFORE UPDATE ON public.gsch_trade_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.gsch_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_project_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_project_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_trade_enquiries ENABLE ROW LEVEL SECURITY;

-- Projects
DROP POLICY IF EXISTS gsch_projects_select ON public.gsch_projects;
CREATE POLICY gsch_projects_select ON public.gsch_projects
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_projects_insert ON public.gsch_projects;
CREATE POLICY gsch_projects_insert ON public.gsch_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_projects_update ON public.gsch_projects;
CREATE POLICY gsch_projects_update ON public.gsch_projects
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- Project saves: user owns rows
DROP POLICY IF EXISTS gsch_project_saves_select ON public.gsch_project_saves;
CREATE POLICY gsch_project_saves_select ON public.gsch_project_saves
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.gsch_is_platform_admin());

DROP POLICY IF EXISTS gsch_project_saves_insert ON public.gsch_project_saves;
CREATE POLICY gsch_project_saves_insert ON public.gsch_project_saves
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS gsch_project_saves_delete ON public.gsch_project_saves;
CREATE POLICY gsch_project_saves_delete ON public.gsch_project_saves
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Project applications
DROP POLICY IF EXISTS gsch_project_applications_select ON public.gsch_project_applications;
CREATE POLICY gsch_project_applications_select ON public.gsch_project_applications
  FOR SELECT TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_projects p
      WHERE p.id = project_id
        AND public.gsch_is_org_member(p.organization_id, auth.uid(), 'member')
    )
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_project_applications_insert ON public.gsch_project_applications;
CREATE POLICY gsch_project_applications_insert ON public.gsch_project_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_user_id = auth.uid());

DROP POLICY IF EXISTS gsch_project_applications_update ON public.gsch_project_applications;
CREATE POLICY gsch_project_applications_update ON public.gsch_project_applications
  FOR UPDATE TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_projects p
      WHERE p.id = project_id
        AND public.gsch_is_org_member(p.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_projects p
      WHERE p.id = project_id
        AND public.gsch_is_org_member(p.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  );

-- Business profiles
DROP POLICY IF EXISTS gsch_business_profiles_select ON public.gsch_business_profiles;
CREATE POLICY gsch_business_profiles_select ON public.gsch_business_profiles
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_business_profiles_insert ON public.gsch_business_profiles;
CREATE POLICY gsch_business_profiles_insert ON public.gsch_business_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_business_profiles_update ON public.gsch_business_profiles;
CREATE POLICY gsch_business_profiles_update ON public.gsch_business_profiles
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- Trade enquiries
DROP POLICY IF EXISTS gsch_trade_enquiries_select ON public.gsch_trade_enquiries;
CREATE POLICY gsch_trade_enquiries_select ON public.gsch_trade_enquiries
  FOR SELECT TO authenticated
  USING (
    public.gsch_is_org_member(from_organization_id, auth.uid(), 'member')
    OR public.gsch_is_org_member(to_organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_trade_enquiries_insert ON public.gsch_trade_enquiries;
CREATE POLICY gsch_trade_enquiries_insert ON public.gsch_trade_enquiries
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(from_organization_id, auth.uid(), 'member')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_trade_enquiries_update ON public.gsch_trade_enquiries;
CREATE POLICY gsch_trade_enquiries_update ON public.gsch_trade_enquiries
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(from_organization_id, auth.uid(), 'member')
    OR public.gsch_is_org_member(to_organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(from_organization_id, auth.uid(), 'member')
    OR public.gsch_is_org_member(to_organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.gsch_projects TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.gsch_project_saves TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_project_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_business_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_trade_enquiries TO authenticated;

GRANT ALL ON public.gsch_projects TO service_role;
GRANT ALL ON public.gsch_project_saves TO service_role;
GRANT ALL ON public.gsch_project_applications TO service_role;
GRANT ALL ON public.gsch_business_profiles TO service_role;
GRANT ALL ON public.gsch_trade_enquiries TO service_role;

-- ---------------------------------------------------------------------------
-- Extend notifications type check (Phase 1–2 types + Phase 3)
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
      'gsch_trade_enquiry_response'
    )
  );
