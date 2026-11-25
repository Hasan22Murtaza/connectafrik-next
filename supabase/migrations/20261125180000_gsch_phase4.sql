-- Global Sister Cities Partnership Hub (GSCH) — Phase 4
-- Additive only. Education, eco-tourism, smart cities, climate marketplace.
-- Reuses set_updated_at, gsch_is_platform_admin, gsch_is_org_member.

-- ---------------------------------------------------------------------------
-- Education programs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_education_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  city_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  description TEXT NULL,
  program_type TEXT NOT NULL CHECK (
    program_type IN (
      'student_exchange',
      'teacher_exchange',
      'research_collaboration',
      'scholarship',
      'innovation_partnership',
      'international_program',
      'other'
    )
  ),
  institution_name TEXT NULL,
  country TEXT NULL,
  continent TEXT NULL,
  location_label TEXT NULL,
  eligibility TEXT NULL,
  duration_label TEXT NULL,
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

CREATE INDEX IF NOT EXISTS idx_gsch_education_programs_org
  ON public.gsch_education_programs (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_education_programs_city
  ON public.gsch_education_programs (city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_education_programs_type
  ON public.gsch_education_programs (program_type);
CREATE INDEX IF NOT EXISTS idx_gsch_education_programs_published
  ON public.gsch_education_programs (is_published);
CREATE INDEX IF NOT EXISTS idx_gsch_education_programs_country
  ON public.gsch_education_programs (country);
CREATE INDEX IF NOT EXISTS idx_gsch_education_programs_created
  ON public.gsch_education_programs (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_education_programs_updated_at ON public.gsch_education_programs;
CREATE TRIGGER trg_gsch_education_programs_updated_at
  BEFORE UPDATE ON public.gsch_education_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Education applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_education_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.gsch_education_programs(id) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  organization_id UUID NULL REFERENCES public.gsch_organizations(id) ON DELETE SET NULL,
  message TEXT NULL,
  contact_email TEXT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'under_review', 'accepted', 'declined', 'withdrawn')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_education_applications_program
  ON public.gsch_education_applications (program_id);
CREATE INDEX IF NOT EXISTS idx_gsch_education_applications_applicant
  ON public.gsch_education_applications (applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_gsch_education_applications_org
  ON public.gsch_education_applications (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_education_applications_status
  ON public.gsch_education_applications (status);

DROP TRIGGER IF EXISTS trg_gsch_education_applications_updated_at ON public.gsch_education_applications;
CREATE TRIGGER trg_gsch_education_applications_updated_at
  BEFORE UPDATE ON public.gsch_education_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tourism initiatives
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_tourism_initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  city_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  description TEXT NULL,
  tourism_type TEXT NOT NULL CHECK (
    tourism_type IN (
      'eco',
      'cultural',
      'indigenous',
      'adventure',
      'route',
      'campaign',
      'other'
    )
  ),
  country TEXT NULL,
  continent TEXT NULL,
  location_label TEXT NULL,
  season_label TEXT NULL,
  partnership_needs TEXT[] NOT NULL DEFAULT '{}',
  external_url TEXT NULL,
  contact_email TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_tourism_initiatives_org
  ON public.gsch_tourism_initiatives (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_tourism_initiatives_city
  ON public.gsch_tourism_initiatives (city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_tourism_initiatives_type
  ON public.gsch_tourism_initiatives (tourism_type);
CREATE INDEX IF NOT EXISTS idx_gsch_tourism_initiatives_published
  ON public.gsch_tourism_initiatives (is_published);
CREATE INDEX IF NOT EXISTS idx_gsch_tourism_initiatives_country
  ON public.gsch_tourism_initiatives (country);
CREATE INDEX IF NOT EXISTS idx_gsch_tourism_initiatives_created
  ON public.gsch_tourism_initiatives (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_tourism_initiatives_updated_at ON public.gsch_tourism_initiatives;
CREATE TRIGGER trg_gsch_tourism_initiatives_updated_at
  BEFORE UPDATE ON public.gsch_tourism_initiatives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tourism partnership requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_tourism_partnership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES public.gsch_tourism_initiatives(id) ON DELETE CASCADE,
  from_organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'under_review', 'accepted', 'declined', 'withdrawn')
  ),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_tourism_partnership_requests_initiative
  ON public.gsch_tourism_partnership_requests (initiative_id);
CREATE INDEX IF NOT EXISTS idx_gsch_tourism_partnership_requests_from
  ON public.gsch_tourism_partnership_requests (from_organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_tourism_partnership_requests_status
  ON public.gsch_tourism_partnership_requests (status);

DROP TRIGGER IF EXISTS trg_gsch_tourism_partnership_requests_updated_at
  ON public.gsch_tourism_partnership_requests;
CREATE TRIGGER trg_gsch_tourism_partnership_requests_updated_at
  BEFORE UPDATE ON public.gsch_tourism_partnership_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Innovation challenges (Smart Cities Lab)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_innovation_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  city_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  description TEXT NULL,
  focus_area TEXT NOT NULL CHECK (
    focus_area IN (
      'ai_transportation',
      'smart_traffic',
      'smart_parking',
      'digital_twins',
      'public_safety',
      'water_management',
      'urban_infrastructure',
      'cybersecurity',
      'other'
    )
  ),
  country TEXT NULL,
  continent TEXT NULL,
  location_label TEXT NULL,
  prize_or_benefit TEXT NULL,
  submission_deadline TIMESTAMPTZ NULL,
  external_url TEXT NULL,
  contact_email TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('draft', 'open', 'closed', 'awarded')
  ),
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_innovation_challenges_org
  ON public.gsch_innovation_challenges (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_innovation_challenges_city
  ON public.gsch_innovation_challenges (city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_innovation_challenges_focus
  ON public.gsch_innovation_challenges (focus_area);
CREATE INDEX IF NOT EXISTS idx_gsch_innovation_challenges_published
  ON public.gsch_innovation_challenges (is_published);
CREATE INDEX IF NOT EXISTS idx_gsch_innovation_challenges_status
  ON public.gsch_innovation_challenges (status);
CREATE INDEX IF NOT EXISTS idx_gsch_innovation_challenges_country
  ON public.gsch_innovation_challenges (country);
CREATE INDEX IF NOT EXISTS idx_gsch_innovation_challenges_created
  ON public.gsch_innovation_challenges (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_innovation_challenges_updated_at
  ON public.gsch_innovation_challenges;
CREATE TRIGGER trg_gsch_innovation_challenges_updated_at
  BEFORE UPDATE ON public.gsch_innovation_challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Innovation submissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_innovation_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.gsch_innovation_challenges(id) ON DELETE CASCADE,
  organization_id UUID NULL REFERENCES public.gsch_organizations(id) ON DELETE SET NULL,
  submitter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  proposal TEXT NOT NULL,
  document_urls TEXT[] NOT NULL DEFAULT '{}',
  contact_email TEXT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN (
      'submitted',
      'under_review',
      'shortlisted',
      'selected',
      'declined',
      'withdrawn'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_innovation_submissions_challenge
  ON public.gsch_innovation_submissions (challenge_id);
CREATE INDEX IF NOT EXISTS idx_gsch_innovation_submissions_submitter
  ON public.gsch_innovation_submissions (submitter_user_id);
CREATE INDEX IF NOT EXISTS idx_gsch_innovation_submissions_org
  ON public.gsch_innovation_submissions (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_innovation_submissions_status
  ON public.gsch_innovation_submissions (status);

DROP TRIGGER IF EXISTS trg_gsch_innovation_submissions_updated_at
  ON public.gsch_innovation_submissions;
CREATE TRIGGER trg_gsch_innovation_submissions_updated_at
  BEFORE UPDATE ON public.gsch_innovation_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Climate projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_climate_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.gsch_organizations(id) ON DELETE CASCADE,
  city_id UUID NULL REFERENCES public.gsch_cities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  description TEXT NULL,
  climate_type TEXT NOT NULL CHECK (
    climate_type IN (
      'renewable_energy',
      'carbon_reduction',
      'waste_management',
      'recycling',
      'water_conservation',
      'climate_adaptation',
      'net_zero',
      'environmental_collaboration',
      'other'
    )
  ),
  country TEXT NULL,
  continent TEXT NULL,
  location_label TEXT NULL,
  seeking_partners TEXT[] NOT NULL DEFAULT '{}',
  estimated_impact TEXT NULL,
  external_url TEXT NULL,
  contact_email TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_climate_projects_org
  ON public.gsch_climate_projects (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_climate_projects_city
  ON public.gsch_climate_projects (city_id);
CREATE INDEX IF NOT EXISTS idx_gsch_climate_projects_type
  ON public.gsch_climate_projects (climate_type);
CREATE INDEX IF NOT EXISTS idx_gsch_climate_projects_published
  ON public.gsch_climate_projects (is_published);
CREATE INDEX IF NOT EXISTS idx_gsch_climate_projects_country
  ON public.gsch_climate_projects (country);
CREATE INDEX IF NOT EXISTS idx_gsch_climate_projects_created
  ON public.gsch_climate_projects (created_at DESC);

DROP TRIGGER IF EXISTS trg_gsch_climate_projects_updated_at ON public.gsch_climate_projects;
CREATE TRIGGER trg_gsch_climate_projects_updated_at
  BEFORE UPDATE ON public.gsch_climate_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Climate interest
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gsch_climate_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  climate_project_id UUID NOT NULL REFERENCES public.gsch_climate_projects(id) ON DELETE CASCADE,
  organization_id UUID NULL REFERENCES public.gsch_organizations(id) ON DELETE SET NULL,
  applicant_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  interest_type TEXT NOT NULL DEFAULT 'general' CHECK (
    interest_type IN (
      'technical_partner',
      'financial_partner',
      'research',
      'general'
    )
  ),
  message TEXT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN ('submitted', 'under_review', 'responded', 'withdrawn', 'closed')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gsch_climate_interest_project
  ON public.gsch_climate_interest (climate_project_id);
CREATE INDEX IF NOT EXISTS idx_gsch_climate_interest_applicant
  ON public.gsch_climate_interest (applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_gsch_climate_interest_org
  ON public.gsch_climate_interest (organization_id);
CREATE INDEX IF NOT EXISTS idx_gsch_climate_interest_status
  ON public.gsch_climate_interest (status);

DROP TRIGGER IF EXISTS trg_gsch_climate_interest_updated_at ON public.gsch_climate_interest;
CREATE TRIGGER trg_gsch_climate_interest_updated_at
  BEFORE UPDATE ON public.gsch_climate_interest
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.gsch_education_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_education_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_tourism_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_tourism_partnership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_innovation_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_innovation_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_climate_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsch_climate_interest ENABLE ROW LEVEL SECURITY;

-- Education programs
DROP POLICY IF EXISTS gsch_education_programs_select ON public.gsch_education_programs;
CREATE POLICY gsch_education_programs_select ON public.gsch_education_programs
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_education_programs_insert ON public.gsch_education_programs;
CREATE POLICY gsch_education_programs_insert ON public.gsch_education_programs
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_education_programs_update ON public.gsch_education_programs;
CREATE POLICY gsch_education_programs_update ON public.gsch_education_programs
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- Education applications
DROP POLICY IF EXISTS gsch_education_applications_select ON public.gsch_education_applications;
CREATE POLICY gsch_education_applications_select ON public.gsch_education_applications
  FOR SELECT TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_education_programs p
      WHERE p.id = program_id
        AND public.gsch_is_org_member(p.organization_id, auth.uid(), 'member')
    )
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_education_applications_insert ON public.gsch_education_applications;
CREATE POLICY gsch_education_applications_insert ON public.gsch_education_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_user_id = auth.uid());

DROP POLICY IF EXISTS gsch_education_applications_update ON public.gsch_education_applications;
CREATE POLICY gsch_education_applications_update ON public.gsch_education_applications
  FOR UPDATE TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_education_programs p
      WHERE p.id = program_id
        AND public.gsch_is_org_member(p.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_education_programs p
      WHERE p.id = program_id
        AND public.gsch_is_org_member(p.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  );

-- Tourism initiatives
DROP POLICY IF EXISTS gsch_tourism_initiatives_select ON public.gsch_tourism_initiatives;
CREATE POLICY gsch_tourism_initiatives_select ON public.gsch_tourism_initiatives
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_tourism_initiatives_insert ON public.gsch_tourism_initiatives;
CREATE POLICY gsch_tourism_initiatives_insert ON public.gsch_tourism_initiatives
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_tourism_initiatives_update ON public.gsch_tourism_initiatives;
CREATE POLICY gsch_tourism_initiatives_update ON public.gsch_tourism_initiatives
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- Tourism partnership requests
DROP POLICY IF EXISTS gsch_tourism_partnership_requests_select
  ON public.gsch_tourism_partnership_requests;
CREATE POLICY gsch_tourism_partnership_requests_select
  ON public.gsch_tourism_partnership_requests
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.gsch_is_org_member(from_organization_id, auth.uid(), 'member')
    OR EXISTS (
      SELECT 1 FROM public.gsch_tourism_initiatives i
      WHERE i.id = initiative_id
        AND public.gsch_is_org_member(i.organization_id, auth.uid(), 'member')
    )
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_tourism_partnership_requests_insert
  ON public.gsch_tourism_partnership_requests;
CREATE POLICY gsch_tourism_partnership_requests_insert
  ON public.gsch_tourism_partnership_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.gsch_is_org_member(from_organization_id, auth.uid(), 'member')
  );

DROP POLICY IF EXISTS gsch_tourism_partnership_requests_update
  ON public.gsch_tourism_partnership_requests;
CREATE POLICY gsch_tourism_partnership_requests_update
  ON public.gsch_tourism_partnership_requests
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.gsch_is_org_member(from_organization_id, auth.uid(), 'member')
    OR EXISTS (
      SELECT 1 FROM public.gsch_tourism_initiatives i
      WHERE i.id = initiative_id
        AND public.gsch_is_org_member(i.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.gsch_is_org_member(from_organization_id, auth.uid(), 'member')
    OR EXISTS (
      SELECT 1 FROM public.gsch_tourism_initiatives i
      WHERE i.id = initiative_id
        AND public.gsch_is_org_member(i.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  );

-- Innovation challenges
DROP POLICY IF EXISTS gsch_innovation_challenges_select ON public.gsch_innovation_challenges;
CREATE POLICY gsch_innovation_challenges_select ON public.gsch_innovation_challenges
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_innovation_challenges_insert ON public.gsch_innovation_challenges;
CREATE POLICY gsch_innovation_challenges_insert ON public.gsch_innovation_challenges
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_innovation_challenges_update ON public.gsch_innovation_challenges;
CREATE POLICY gsch_innovation_challenges_update ON public.gsch_innovation_challenges
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- Innovation submissions
DROP POLICY IF EXISTS gsch_innovation_submissions_select ON public.gsch_innovation_submissions;
CREATE POLICY gsch_innovation_submissions_select ON public.gsch_innovation_submissions
  FOR SELECT TO authenticated
  USING (
    submitter_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_innovation_challenges c
      WHERE c.id = challenge_id
        AND public.gsch_is_org_member(c.organization_id, auth.uid(), 'member')
    )
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_innovation_submissions_insert ON public.gsch_innovation_submissions;
CREATE POLICY gsch_innovation_submissions_insert ON public.gsch_innovation_submissions
  FOR INSERT TO authenticated
  WITH CHECK (submitter_user_id = auth.uid());

DROP POLICY IF EXISTS gsch_innovation_submissions_update ON public.gsch_innovation_submissions;
CREATE POLICY gsch_innovation_submissions_update ON public.gsch_innovation_submissions
  FOR UPDATE TO authenticated
  USING (
    submitter_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_innovation_challenges c
      WHERE c.id = challenge_id
        AND public.gsch_is_org_member(c.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    submitter_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_innovation_challenges c
      WHERE c.id = challenge_id
        AND public.gsch_is_org_member(c.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  );

-- Climate projects
DROP POLICY IF EXISTS gsch_climate_projects_select ON public.gsch_climate_projects;
CREATE POLICY gsch_climate_projects_select ON public.gsch_climate_projects
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.gsch_is_org_member(organization_id, auth.uid(), 'member')
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_climate_projects_insert ON public.gsch_climate_projects;
CREATE POLICY gsch_climate_projects_insert ON public.gsch_climate_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
      OR public.gsch_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS gsch_climate_projects_update ON public.gsch_climate_projects;
CREATE POLICY gsch_climate_projects_update ON public.gsch_climate_projects
  FOR UPDATE TO authenticated
  USING (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    public.gsch_is_org_member(organization_id, auth.uid(), 'representative')
    OR public.gsch_is_platform_admin()
  );

-- Climate interest
DROP POLICY IF EXISTS gsch_climate_interest_select ON public.gsch_climate_interest;
CREATE POLICY gsch_climate_interest_select ON public.gsch_climate_interest
  FOR SELECT TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_climate_projects p
      WHERE p.id = climate_project_id
        AND public.gsch_is_org_member(p.organization_id, auth.uid(), 'member')
    )
    OR public.gsch_is_platform_admin()
  );

DROP POLICY IF EXISTS gsch_climate_interest_insert ON public.gsch_climate_interest;
CREATE POLICY gsch_climate_interest_insert ON public.gsch_climate_interest
  FOR INSERT TO authenticated
  WITH CHECK (applicant_user_id = auth.uid());

DROP POLICY IF EXISTS gsch_climate_interest_update ON public.gsch_climate_interest;
CREATE POLICY gsch_climate_interest_update ON public.gsch_climate_interest
  FOR UPDATE TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_climate_projects p
      WHERE p.id = climate_project_id
        AND public.gsch_is_org_member(p.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  )
  WITH CHECK (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.gsch_climate_projects p
      WHERE p.id = climate_project_id
        AND public.gsch_is_org_member(p.organization_id, auth.uid(), 'representative')
    )
    OR public.gsch_is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.gsch_education_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_education_applications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_tourism_initiatives TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_tourism_partnership_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_innovation_challenges TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_innovation_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_climate_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gsch_climate_interest TO authenticated;

GRANT ALL ON public.gsch_education_programs TO service_role;
GRANT ALL ON public.gsch_education_applications TO service_role;
GRANT ALL ON public.gsch_tourism_initiatives TO service_role;
GRANT ALL ON public.gsch_tourism_partnership_requests TO service_role;
GRANT ALL ON public.gsch_innovation_challenges TO service_role;
GRANT ALL ON public.gsch_innovation_submissions TO service_role;
GRANT ALL ON public.gsch_climate_projects TO service_role;
GRANT ALL ON public.gsch_climate_interest TO service_role;

-- ---------------------------------------------------------------------------
-- Extend notifications type check (Phase 1–3 types + Phase 4)
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
      'gsch_climate_interest'
    )
  );
