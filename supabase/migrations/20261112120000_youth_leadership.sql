-- Youth Leadership Programs (additive, backward compatible).
-- Creates new youth_* tables only. Does not rename/remove existing columns.
-- Optional parental_controls.youth_leadership_enabled is NULLABLE (NULL = allowed).

-- ---------------------------------------------------------------------------
-- Helper: updated_at (idempotent)
-- ---------------------------------------------------------------------------
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
-- Optional parental gate (NULL = unrestricted / existing behavior)
-- ---------------------------------------------------------------------------
ALTER TABLE public.parental_controls
  ADD COLUMN IF NOT EXISTS youth_leadership_enabled BOOLEAN NULL;

COMMENT ON COLUMN public.parental_controls.youth_leadership_enabled IS
  'When FALSE, managed child/teen cannot use Youth Leadership. NULL/TRUE = allowed.';

-- ---------------------------------------------------------------------------
-- Configurable categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_program_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_youth_program_categories_updated_at ON public.youth_program_categories;
CREATE TRIGGER trg_youth_program_categories_updated_at
  BEFORE UPDATE ON public.youth_program_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.youth_program_categories (slug, name, sort_order) VALUES
  ('leadership', 'Leadership', 10),
  ('technology', 'Technology', 20),
  ('entrepreneurship', 'Entrepreneurship', 30),
  ('education', 'Education', 40),
  ('community_service', 'Community Service', 50),
  ('environment', 'Environment', 60),
  ('public_speaking', 'Public Speaking', 70),
  ('career_development', 'Career Development', 80),
  ('arts_culture', 'Arts & Culture', 90),
  ('stem', 'STEM', 100),
  ('volunteering', 'Volunteering', 110),
  ('social_impact', 'Social Impact', 120)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  logo_url TEXT NULL,
  website TEXT NULL,
  country TEXT NULL,
  region TEXT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    verification_status IN ('pending', 'verified', 'rejected', 'suspended')
  ),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  verified_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youth_orgs_created_by ON public.youth_organizations (created_by);
CREATE INDEX IF NOT EXISTS idx_youth_orgs_verification ON public.youth_organizations (verification_status);

DROP TRIGGER IF EXISTS trg_youth_organizations_updated_at ON public.youth_organizations;
CREATE TRIGGER trg_youth_organizations_updated_at
  BEFORE UPDATE ON public.youth_organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.youth_organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.youth_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coordinator', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT youth_org_members_unique UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_youth_org_members_user ON public.youth_organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_youth_org_members_org_status ON public.youth_organization_members (organization_id, status);

DROP TRIGGER IF EXISTS trg_youth_organization_members_updated_at ON public.youth_organization_members;
CREATE TRIGGER trg_youth_organization_members_updated_at
  BEFORE UPDATE ON public.youth_organization_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Programs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.youth_organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NULL,
  objectives TEXT NULL,
  category_id UUID NULL REFERENCES public.youth_program_categories(id) ON DELETE SET NULL,
  category_slug TEXT NULL,
  eligibility TEXT NULL,
  minimum_age INTEGER NULL CHECK (minimum_age IS NULL OR (minimum_age >= 0 AND minimum_age <= 100)),
  maximum_age INTEGER NULL CHECK (maximum_age IS NULL OR (maximum_age >= 0 AND maximum_age <= 100)),
  required_skills TEXT[] NULL,
  format TEXT NOT NULL DEFAULT 'hybrid' CHECK (format IN ('online', 'in_person', 'hybrid')),
  location_region TEXT NULL,
  country TEXT NULL,
  schedule TEXT NULL,
  requirements TEXT NULL,
  safety_information TEXT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  application_deadline TIMESTAMPTZ NULL,
  capacity INTEGER NULL CHECK (capacity IS NULL OR capacity > 0),
  seats_taken INTEGER NOT NULL DEFAULT 0 CHECK (seats_taken >= 0),
  requires_guardian_approval BOOLEAN NOT NULL DEFAULT false,
  application_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_review', 'published', 'closed', 'archived', 'suspended')
  ),
  popularity_score INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT youth_programs_age_range CHECK (
    minimum_age IS NULL OR maximum_age IS NULL OR minimum_age <= maximum_age
  )
);

CREATE INDEX IF NOT EXISTS idx_youth_programs_org ON public.youth_programs (organization_id);
CREATE INDEX IF NOT EXISTS idx_youth_programs_status ON public.youth_programs (status);
CREATE INDEX IF NOT EXISTS idx_youth_programs_category ON public.youth_programs (category_slug);
CREATE INDEX IF NOT EXISTS idx_youth_programs_deadline ON public.youth_programs (application_deadline);
CREATE INDEX IF NOT EXISTS idx_youth_programs_format ON public.youth_programs (format);
CREATE INDEX IF NOT EXISTS idx_youth_programs_country ON public.youth_programs (country);

DROP TRIGGER IF EXISTS trg_youth_programs_updated_at ON public.youth_programs;
CREATE TRIGGER trg_youth_programs_updated_at
  BEFORE UPDATE ON public.youth_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Applications & enrollments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_program_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.youth_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft', 'submitted', 'under_review', 'accepted',
      'waitlisted', 'rejected', 'withdrawn', 'completed'
    )
  ),
  application_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  guardian_approval_status TEXT NULL CHECK (
    guardian_approval_status IS NULL OR guardian_approval_status IN (
      'not_required', 'pending', 'approved', 'rejected'
    )
  ),
  guardian_reviewed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  guardian_reviewed_at TIMESTAMPTZ NULL,
  submitted_at TIMESTAMPTZ NULL,
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT youth_program_applications_unique UNIQUE (program_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_youth_apps_user ON public.youth_program_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_youth_apps_program_status ON public.youth_program_applications (program_id, status);

DROP TRIGGER IF EXISTS trg_youth_program_applications_updated_at ON public.youth_program_applications;
CREATE TRIGGER trg_youth_program_applications_updated_at
  BEFORE UPDATE ON public.youth_program_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.youth_program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.youth_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id UUID NULL REFERENCES public.youth_program_applications(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'completed', 'withdrawn', 'removed')
  ),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT youth_program_enrollments_unique UNIQUE (program_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_youth_enrollments_user ON public.youth_program_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_youth_enrollments_program ON public.youth_program_enrollments (program_id, status);

DROP TRIGGER IF EXISTS trg_youth_program_enrollments_updated_at ON public.youth_program_enrollments;
CREATE TRIGGER trg_youth_program_enrollments_updated_at
  BEFORE UPDATE ON public.youth_program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mentorship
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  expertise TEXT[] NULL,
  skills TEXT[] NULL,
  bio TEXT NULL,
  languages TEXT[] NULL,
  experience_summary TEXT NULL,
  mentorship_interests TEXT[] NULL,
  availability JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    verification_status IN ('pending', 'verified', 'rejected', 'suspended')
  ),
  verified_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NULL,
  accepts_minors BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youth_mentors_verification ON public.youth_mentors (verification_status);

DROP TRIGGER IF EXISTS trg_youth_mentors_updated_at ON public.youth_mentors;
CREATE TRIGGER trg_youth_mentors_updated_at
  BEFORE UPDATE ON public.youth_mentors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.youth_mentorship_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.youth_mentors(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NULL REFERENCES public.youth_programs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (
    status IN (
      'requested', 'pending_guardian', 'active', 'completed',
      'declined', 'cancelled', 'suspended'
    )
  ),
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  guardian_approval_status TEXT NULL CHECK (
    guardian_approval_status IS NULL OR guardian_approval_status IN (
      'not_required', 'pending', 'approved', 'rejected'
    )
  ),
  chat_thread_id UUID NULL,
  started_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT youth_mentorship_matches_unique UNIQUE (mentor_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_youth_mentorship_participant ON public.youth_mentorship_matches (participant_id);
CREATE INDEX IF NOT EXISTS idx_youth_mentorship_status ON public.youth_mentorship_matches (status);

DROP TRIGGER IF EXISTS trg_youth_mentorship_matches_updated_at ON public.youth_mentorship_matches;
CREATE TRIGGER trg_youth_mentorship_matches_updated_at
  BEFORE UPDATE ON public.youth_mentorship_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Community projects & tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NULL REFERENCES public.youth_organizations(id) ON DELETE SET NULL,
  program_id UUID NULL REFERENCES public.youth_programs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  objective TEXT NULL,
  skills_required TEXT[] NULL,
  max_participants INTEGER NULL CHECK (max_participants IS NULL OR max_participants > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'pending_approval', 'approved', 'active', 'completed', 'cancelled')
  ),
  start_date DATE NULL,
  end_date DATE NULL,
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youth_projects_org ON public.youth_projects (organization_id);
CREATE INDEX IF NOT EXISTS idx_youth_projects_status ON public.youth_projects (status);

DROP TRIGGER IF EXISTS trg_youth_projects_updated_at ON public.youth_projects;
CREATE TRIGGER trg_youth_projects_updated_at
  BEFORE UPDATE ON public.youth_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.youth_project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.youth_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (
    role IN ('coordinator', 'participant', 'volunteer')
  ),
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('invited', 'active', 'completed', 'removed', 'left')
  ),
  joined_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT youth_project_members_unique UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_youth_project_members_user ON public.youth_project_members (user_id);

DROP TRIGGER IF EXISTS trg_youth_project_members_updated_at ON public.youth_project_members;
CREATE TRIGGER trg_youth_project_members_updated_at
  BEFORE UPDATE ON public.youth_project_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.youth_project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.youth_projects(id) ON DELETE CASCADE,
  assigned_to UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (
    status IN ('todo', 'in_progress', 'completed', 'verified')
  ),
  completed_at TIMESTAMPTZ NULL,
  verified_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youth_project_tasks_project ON public.youth_project_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_youth_project_tasks_assignee ON public.youth_project_tasks (assigned_to);

DROP TRIGGER IF EXISTS trg_youth_project_tasks_updated_at ON public.youth_project_tasks;
CREATE TRIGGER trg_youth_project_tasks_updated_at
  BEFORE UPDATE ON public.youth_project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Events (standalone; optional link to group_events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NULL REFERENCES public.youth_organizations(id) ON DELETE SET NULL,
  program_id UUID NULL REFERENCES public.youth_programs(id) ON DELETE SET NULL,
  project_id UUID NULL REFERENCES public.youth_projects(id) ON DELETE SET NULL,
  group_event_id UUID NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  event_type TEXT NOT NULL DEFAULT 'workshop' CHECK (
    event_type IN (
      'workshop', 'webinar', 'leadership_session', 'mentorship_session',
      'community_event', 'training'
    )
  ),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NULL,
  format TEXT NOT NULL DEFAULT 'online' CHECK (format IN ('online', 'in_person', 'hybrid')),
  location_region TEXT NULL,
  access_info TEXT NULL,
  capacity INTEGER NULL CHECK (capacity IS NULL OR capacity > 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('draft', 'scheduled', 'ongoing', 'completed', 'cancelled')
  ),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youth_events_start ON public.youth_events (start_at);
CREATE INDEX IF NOT EXISTS idx_youth_events_program ON public.youth_events (program_id);
CREATE INDEX IF NOT EXISTS idx_youth_events_org ON public.youth_events (organization_id);

DROP TRIGGER IF EXISTS trg_youth_events_updated_at ON public.youth_events;
CREATE TRIGGER trg_youth_events_updated_at
  BEFORE UPDATE ON public.youth_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.youth_event_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.youth_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_status TEXT NOT NULL DEFAULT 'registered' CHECK (
    attendance_status IN ('registered', 'attended', 'absent', 'cancelled')
  ),
  verified_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT youth_event_attendance_unique UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_youth_event_attendance_user ON public.youth_event_attendance (user_id);

DROP TRIGGER IF EXISTS trg_youth_event_attendance_updated_at ON public.youth_event_attendance;
CREATE TRIGGER trg_youth_event_attendance_updated_at
  BEFORE UPDATE ON public.youth_event_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Achievements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NULL REFERENCES public.youth_programs(id) ON DELETE SET NULL,
  project_id UUID NULL REFERENCES public.youth_projects(id) ON DELETE SET NULL,
  organization_id UUID NULL REFERENCES public.youth_organizations(id) ON DELETE SET NULL,
  achievement_type TEXT NOT NULL CHECK (
    achievement_type IN (
      'program_completion', 'skill', 'course', 'volunteer',
      'project_contribution', 'mentorship_milestone', 'badge', 'certificate', 'other'
    )
  ),
  title TEXT NOT NULL,
  description TEXT NULL,
  skills TEXT[] NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    verification_status IN ('pending', 'verified', 'rejected')
  ),
  verified_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NULL,
  certificate_url TEXT NULL,
  badge_slug TEXT NULL,
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youth_achievements_user ON public.youth_achievements (user_id);
CREATE INDEX IF NOT EXISTS idx_youth_achievements_status ON public.youth_achievements (verification_status);

DROP TRIGGER IF EXISTS trg_youth_achievements_updated_at ON public.youth_achievements;
CREATE TRIGGER trg_youth_achievements_updated_at
  BEFORE UPDATE ON public.youth_achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Safety reports (highly restricted)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  program_id UUID NULL REFERENCES public.youth_programs(id) ON DELETE SET NULL,
  project_id UUID NULL REFERENCES public.youth_projects(id) ON DELETE SET NULL,
  mentorship_id UUID NULL REFERENCES public.youth_mentorship_matches(id) ON DELETE SET NULL,
  organization_id UUID NULL REFERENCES public.youth_organizations(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (
    report_type IN (
      'safety', 'harassment', 'inappropriate_content', 'suspicious_contact',
      'child_abuse', 'policy_violation', 'other'
    )
  ),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'under_review', 'resolved', 'dismissed')
  ),
  reviewed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  resolution_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youth_safety_reports_status ON public.youth_safety_reports (status);
CREATE INDEX IF NOT EXISTS idx_youth_safety_reports_reporter ON public.youth_safety_reports (reporter_id);

DROP TRIGGER IF EXISTS trg_youth_safety_reports_updated_at ON public.youth_safety_reports;
CREATE TRIGGER trg_youth_safety_reports_updated_at
  BEFORE UPDATE ON public.youth_safety_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log for sensitive youth admin actions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.youth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_youth_audit_logs_actor ON public.youth_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_youth_audit_logs_entity ON public.youth_audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_youth_audit_logs_created ON public.youth_audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (avoid recursive RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.youth_is_platform_admin(uid UUID DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.youth_is_org_member(
  org_id UUID,
  uid UUID DEFAULT auth.uid(),
  min_role TEXT DEFAULT 'viewer'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.youth_organization_members m
    WHERE m.organization_id = org_id
      AND m.user_id = uid
      AND m.status = 'active'
      AND (
        min_role = 'viewer'
        OR (min_role = 'coordinator' AND m.role IN ('admin', 'coordinator'))
        OR (min_role = 'admin' AND m.role = 'admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.youth_is_org_member_of_program(
  prog_id UUID,
  uid UUID DEFAULT auth.uid(),
  min_role TEXT DEFAULT 'viewer'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.youth_programs p
    JOIN public.youth_organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = prog_id
      AND m.user_id = uid
      AND m.status = 'active'
      AND (
        min_role = 'viewer'
        OR (min_role = 'coordinator' AND m.role IN ('admin', 'coordinator'))
        OR (min_role = 'admin' AND m.role = 'admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.youth_is_active_parent_of(child_uid UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members child
    JOIN public.family_members parent
      ON parent.family_id = child.family_id
     AND parent.user_id = uid
     AND parent.role = 'parent'
     AND parent.status = 'active'
    WHERE child.user_id = child_uid
      AND child.role IN ('child', 'teen')
      AND child.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.youth_program_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_program_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_mentorship_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youth_audit_logs ENABLE ROW LEVEL SECURITY;

-- Categories: public read of active; admin manage
DROP POLICY IF EXISTS youth_categories_select ON public.youth_program_categories;
CREATE POLICY youth_categories_select ON public.youth_program_categories
  FOR SELECT TO authenticated
  USING (is_active = true OR public.youth_is_platform_admin());

DROP POLICY IF EXISTS youth_categories_admin_all ON public.youth_program_categories;
CREATE POLICY youth_categories_admin_all ON public.youth_program_categories
  FOR ALL TO authenticated
  USING (public.youth_is_platform_admin())
  WITH CHECK (public.youth_is_platform_admin());

-- Organizations
DROP POLICY IF EXISTS youth_orgs_select ON public.youth_organizations;
CREATE POLICY youth_orgs_select ON public.youth_organizations
  FOR SELECT TO authenticated
  USING (
    verification_status = 'verified'
    OR created_by = auth.uid()
    OR public.youth_is_org_member(id)
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_orgs_insert ON public.youth_organizations;
CREATE POLICY youth_orgs_insert ON public.youth_organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS youth_orgs_update ON public.youth_organizations;
CREATE POLICY youth_orgs_update ON public.youth_organizations
  FOR UPDATE TO authenticated
  USING (
    public.youth_is_org_member(id, auth.uid(), 'admin')
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    public.youth_is_org_member(id, auth.uid(), 'admin')
    OR public.youth_is_platform_admin()
  );

-- Org members
DROP POLICY IF EXISTS youth_org_members_select ON public.youth_organization_members;
CREATE POLICY youth_org_members_select ON public.youth_organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.youth_is_org_member(organization_id)
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_org_members_insert ON public.youth_organization_members;
CREATE POLICY youth_org_members_insert ON public.youth_organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.youth_is_org_member(organization_id, auth.uid(), 'admin')
    OR public.youth_is_platform_admin()
    OR (
      -- Bootstrap: org creator can add themselves as admin
      user_id = auth.uid()
      AND role = 'admin'
      AND EXISTS (
        SELECT 1 FROM public.youth_organizations o
        WHERE o.id = organization_id AND o.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS youth_org_members_update ON public.youth_organization_members;
CREATE POLICY youth_org_members_update ON public.youth_organization_members
  FOR UPDATE TO authenticated
  USING (
    public.youth_is_org_member(organization_id, auth.uid(), 'admin')
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    public.youth_is_org_member(organization_id, auth.uid(), 'admin')
    OR public.youth_is_platform_admin()
  );

-- Programs
DROP POLICY IF EXISTS youth_programs_select ON public.youth_programs;
CREATE POLICY youth_programs_select ON public.youth_programs
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR public.youth_is_org_member(organization_id)
    OR created_by = auth.uid()
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_programs_insert ON public.youth_programs;
CREATE POLICY youth_programs_insert ON public.youth_programs
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.youth_is_org_member(organization_id, auth.uid(), 'coordinator')
      OR public.youth_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS youth_programs_update ON public.youth_programs;
CREATE POLICY youth_programs_update ON public.youth_programs
  FOR UPDATE TO authenticated
  USING (
    public.youth_is_org_member(organization_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    public.youth_is_org_member(organization_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  );

-- Applications
DROP POLICY IF EXISTS youth_apps_select ON public.youth_program_applications;
CREATE POLICY youth_apps_select ON public.youth_program_applications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.youth_is_org_member_of_program(program_id, auth.uid(), 'coordinator')
    OR public.youth_is_active_parent_of(user_id)
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_apps_insert ON public.youth_program_applications;
CREATE POLICY youth_apps_insert ON public.youth_program_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS youth_apps_update ON public.youth_program_applications;
CREATE POLICY youth_apps_update ON public.youth_program_applications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.youth_is_org_member_of_program(program_id, auth.uid(), 'coordinator')
    OR public.youth_is_active_parent_of(user_id)
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.youth_is_org_member_of_program(program_id, auth.uid(), 'coordinator')
    OR public.youth_is_active_parent_of(user_id)
    OR public.youth_is_platform_admin()
  );

-- Enrollments
DROP POLICY IF EXISTS youth_enroll_select ON public.youth_program_enrollments;
CREATE POLICY youth_enroll_select ON public.youth_program_enrollments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.youth_is_org_member_of_program(program_id, auth.uid(), 'coordinator')
    OR public.youth_is_active_parent_of(user_id)
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_enroll_insert ON public.youth_program_enrollments;
CREATE POLICY youth_enroll_insert ON public.youth_program_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.youth_is_org_member_of_program(program_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_enroll_update ON public.youth_program_enrollments;
CREATE POLICY youth_enroll_update ON public.youth_program_enrollments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.youth_is_org_member_of_program(program_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.youth_is_org_member_of_program(program_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  );

-- Mentors
DROP POLICY IF EXISTS youth_mentors_select ON public.youth_mentors;
CREATE POLICY youth_mentors_select ON public.youth_mentors
  FOR SELECT TO authenticated
  USING (
    verification_status = 'verified'
    OR user_id = auth.uid()
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_mentors_insert ON public.youth_mentors;
CREATE POLICY youth_mentors_insert ON public.youth_mentors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS youth_mentors_update ON public.youth_mentors;
CREATE POLICY youth_mentors_update ON public.youth_mentors
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.youth_is_platform_admin())
  WITH CHECK (user_id = auth.uid() OR public.youth_is_platform_admin());

-- Mentorship matches
DROP POLICY IF EXISTS youth_matches_select ON public.youth_mentorship_matches;
CREATE POLICY youth_matches_select ON public.youth_mentorship_matches
  FOR SELECT TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_mentors m
      WHERE m.id = mentor_id AND m.user_id = auth.uid()
    )
    OR public.youth_is_active_parent_of(participant_id)
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_matches_insert ON public.youth_mentorship_matches;
CREATE POLICY youth_matches_insert ON public.youth_mentorship_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_mentors m
      WHERE m.id = mentor_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS youth_matches_update ON public.youth_mentorship_matches;
CREATE POLICY youth_matches_update ON public.youth_mentorship_matches
  FOR UPDATE TO authenticated
  USING (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_mentors m
      WHERE m.id = mentor_id AND m.user_id = auth.uid()
    )
    OR public.youth_is_active_parent_of(participant_id)
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    participant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_mentors m
      WHERE m.id = mentor_id AND m.user_id = auth.uid()
    )
    OR public.youth_is_active_parent_of(participant_id)
    OR public.youth_is_platform_admin()
  );

-- Projects
DROP POLICY IF EXISTS youth_projects_select ON public.youth_projects;
CREATE POLICY youth_projects_select ON public.youth_projects
  FOR SELECT TO authenticated
  USING (
    status IN ('approved', 'active', 'completed')
    OR created_by = auth.uid()
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id))
    OR EXISTS (
      SELECT 1 FROM public.youth_project_members pm
      WHERE pm.project_id = id AND pm.user_id = auth.uid()
        AND pm.status IN ('invited', 'active', 'completed')
    )
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_projects_insert ON public.youth_projects;
CREATE POLICY youth_projects_insert ON public.youth_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      organization_id IS NULL
      OR public.youth_is_org_member(organization_id, auth.uid(), 'coordinator')
      OR public.youth_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS youth_projects_update ON public.youth_projects;
CREATE POLICY youth_projects_update ON public.youth_projects
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id, auth.uid(), 'coordinator'))
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id, auth.uid(), 'coordinator'))
    OR public.youth_is_platform_admin()
  );

-- Project members
DROP POLICY IF EXISTS youth_pm_select ON public.youth_project_members;
CREATE POLICY youth_pm_select ON public.youth_project_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_projects p
      WHERE p.id = project_id
        AND (
          p.created_by = auth.uid()
          OR (p.organization_id IS NOT NULL AND public.youth_is_org_member(p.organization_id))
        )
    )
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_pm_insert ON public.youth_project_members;
CREATE POLICY youth_pm_insert ON public.youth_project_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_projects p
      WHERE p.id = project_id
        AND (
          p.created_by = auth.uid()
          OR (p.organization_id IS NOT NULL AND public.youth_is_org_member(p.organization_id, auth.uid(), 'coordinator'))
        )
    )
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_pm_update ON public.youth_project_members;
CREATE POLICY youth_pm_update ON public.youth_project_members
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_projects p
      WHERE p.id = project_id
        AND (
          p.created_by = auth.uid()
          OR (p.organization_id IS NOT NULL AND public.youth_is_org_member(p.organization_id, auth.uid(), 'coordinator'))
        )
    )
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_projects p
      WHERE p.id = project_id
        AND (
          p.created_by = auth.uid()
          OR (p.organization_id IS NOT NULL AND public.youth_is_org_member(p.organization_id, auth.uid(), 'coordinator'))
        )
    )
    OR public.youth_is_platform_admin()
  );

-- Project tasks
DROP POLICY IF EXISTS youth_tasks_select ON public.youth_project_tasks;
CREATE POLICY youth_tasks_select ON public.youth_project_tasks
  FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.youth_projects p
      WHERE p.id = project_id
        AND (
          p.created_by = auth.uid()
          OR (p.organization_id IS NOT NULL AND public.youth_is_org_member(p.organization_id))
        )
    )
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_tasks_insert ON public.youth_project_tasks;
CREATE POLICY youth_tasks_insert ON public.youth_project_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.youth_project_members pm
        WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
          AND pm.status = 'active' AND pm.role = 'coordinator'
      )
      OR EXISTS (
        SELECT 1 FROM public.youth_projects p
        WHERE p.id = project_id
          AND (
            p.created_by = auth.uid()
            OR (p.organization_id IS NOT NULL AND public.youth_is_org_member(p.organization_id, auth.uid(), 'coordinator'))
          )
      )
      OR public.youth_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS youth_tasks_update ON public.youth_project_tasks;
CREATE POLICY youth_tasks_update ON public.youth_project_tasks
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
        AND pm.status = 'active' AND pm.role = 'coordinator'
    )
    OR EXISTS (
      SELECT 1 FROM public.youth_projects p
      WHERE p.id = project_id
        AND (
          p.created_by = auth.uid()
          OR (p.organization_id IS NOT NULL AND public.youth_is_org_member(p.organization_id, auth.uid(), 'coordinator'))
        )
    )
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_project_members pm
      WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
        AND pm.status = 'active' AND pm.role = 'coordinator'
    )
    OR EXISTS (
      SELECT 1 FROM public.youth_projects p
      WHERE p.id = project_id
        AND (
          p.created_by = auth.uid()
          OR (p.organization_id IS NOT NULL AND public.youth_is_org_member(p.organization_id, auth.uid(), 'coordinator'))
        )
    )
    OR public.youth_is_platform_admin()
  );

-- Events
DROP POLICY IF EXISTS youth_events_select ON public.youth_events;
CREATE POLICY youth_events_select ON public.youth_events
  FOR SELECT TO authenticated
  USING (
    status IN ('scheduled', 'ongoing', 'completed')
    OR created_by = auth.uid()
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id))
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_events_insert ON public.youth_events;
CREATE POLICY youth_events_insert ON public.youth_events
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      organization_id IS NULL
      OR public.youth_is_org_member(organization_id, auth.uid(), 'coordinator')
      OR public.youth_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS youth_events_update ON public.youth_events;
CREATE POLICY youth_events_update ON public.youth_events
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id, auth.uid(), 'coordinator'))
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id, auth.uid(), 'coordinator'))
    OR public.youth_is_platform_admin()
  );

-- Event attendance
DROP POLICY IF EXISTS youth_attendance_select ON public.youth_event_attendance;
CREATE POLICY youth_attendance_select ON public.youth_event_attendance
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_events e
      WHERE e.id = event_id
        AND (
          e.created_by = auth.uid()
          OR (e.organization_id IS NOT NULL AND public.youth_is_org_member(e.organization_id))
        )
    )
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_attendance_insert ON public.youth_event_attendance;
CREATE POLICY youth_attendance_insert ON public.youth_event_attendance
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.youth_is_platform_admin());

DROP POLICY IF EXISTS youth_attendance_update ON public.youth_event_attendance;
CREATE POLICY youth_attendance_update ON public.youth_event_attendance
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_events e
      WHERE e.id = event_id
        AND (
          e.created_by = auth.uid()
          OR (e.organization_id IS NOT NULL AND public.youth_is_org_member(e.organization_id, auth.uid(), 'coordinator'))
        )
    )
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.youth_events e
      WHERE e.id = event_id
        AND (
          e.created_by = auth.uid()
          OR (e.organization_id IS NOT NULL AND public.youth_is_org_member(e.organization_id, auth.uid(), 'coordinator'))
        )
    )
    OR public.youth_is_platform_admin()
  );

-- Achievements: owners can read; cannot self-verify
DROP POLICY IF EXISTS youth_achievements_select ON public.youth_achievements;
CREATE POLICY youth_achievements_select ON public.youth_achievements
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.youth_is_active_parent_of(user_id)
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id))
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_achievements_insert ON public.youth_achievements;
CREATE POLICY youth_achievements_insert ON public.youth_achievements
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND verification_status = 'pending'
    )
    OR (
      organization_id IS NOT NULL
      AND public.youth_is_org_member(organization_id, auth.uid(), 'coordinator')
    )
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_achievements_update ON public.youth_achievements;
CREATE POLICY youth_achievements_update ON public.youth_achievements
  FOR UPDATE TO authenticated
  USING (
    (
      user_id = auth.uid()
      AND verification_status = 'pending'
    )
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id, auth.uid(), 'coordinator'))
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    (
      user_id = auth.uid()
      AND verification_status = 'pending'
    )
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id, auth.uid(), 'coordinator'))
    OR public.youth_is_platform_admin()
  );

-- Safety reports: reporter insert/select own; admins manage; deny broad read
DROP POLICY IF EXISTS youth_safety_select ON public.youth_safety_reports;
CREATE POLICY youth_safety_select ON public.youth_safety_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_safety_insert ON public.youth_safety_reports;
CREATE POLICY youth_safety_insert ON public.youth_safety_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS youth_safety_update ON public.youth_safety_reports;
CREATE POLICY youth_safety_update ON public.youth_safety_reports
  FOR UPDATE TO authenticated
  USING (public.youth_is_platform_admin())
  WITH CHECK (public.youth_is_platform_admin());

-- Audit logs: admin read; insert via service role / SECURITY DEFINER preferred
DROP POLICY IF EXISTS youth_audit_select ON public.youth_audit_logs;
CREATE POLICY youth_audit_select ON public.youth_audit_logs
  FOR SELECT TO authenticated
  USING (public.youth_is_platform_admin());

DROP POLICY IF EXISTS youth_audit_insert ON public.youth_audit_logs;
CREATE POLICY youth_audit_insert ON public.youth_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.youth_is_platform_admin());

-- Deny client DELETE on safety + audit (service role only)
DROP POLICY IF EXISTS youth_safety_delete_deny ON public.youth_safety_reports;
CREATE POLICY youth_safety_delete_deny ON public.youth_safety_reports
  FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS youth_audit_delete_deny ON public.youth_audit_logs;
CREATE POLICY youth_audit_delete_deny ON public.youth_audit_logs
  FOR DELETE TO authenticated
  USING (false);

-- Grants
GRANT SELECT ON public.youth_program_categories TO authenticated;
GRANT ALL ON public.youth_program_categories TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_organizations TO authenticated;
GRANT ALL ON public.youth_organizations TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_organization_members TO authenticated;
GRANT ALL ON public.youth_organization_members TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_programs TO authenticated;
GRANT ALL ON public.youth_programs TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_program_applications TO authenticated;
GRANT ALL ON public.youth_program_applications TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_program_enrollments TO authenticated;
GRANT ALL ON public.youth_program_enrollments TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_mentors TO authenticated;
GRANT ALL ON public.youth_mentors TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_mentorship_matches TO authenticated;
GRANT ALL ON public.youth_mentorship_matches TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_projects TO authenticated;
GRANT ALL ON public.youth_projects TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_project_members TO authenticated;
GRANT ALL ON public.youth_project_members TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_project_tasks TO authenticated;
GRANT ALL ON public.youth_project_tasks TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_events TO authenticated;
GRANT ALL ON public.youth_events TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_event_attendance TO authenticated;
GRANT ALL ON public.youth_event_attendance TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_achievements TO authenticated;
GRANT ALL ON public.youth_achievements TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.youth_safety_reports TO authenticated;
GRANT ALL ON public.youth_safety_reports TO service_role;

GRANT SELECT, INSERT ON public.youth_audit_logs TO authenticated;
GRANT ALL ON public.youth_audit_logs TO service_role;

-- ---------------------------------------------------------------------------
-- Extend notifications type check (additive — keeps all prior types)
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
      'youth_guardian_approval'
    )
  );
