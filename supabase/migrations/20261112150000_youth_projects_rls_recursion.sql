-- Break the youth_projects <-> youth_project_members RLS cycle.
-- Selecting youth_projects evaluated youth_project_members, whose policies
-- selected youth_projects again: "infinite recursion detected in policy".
-- Membership and ownership checks now run as SECURITY DEFINER, same as
-- youth_is_org_member.

CREATE OR REPLACE FUNCTION public.youth_is_project_member(
  proj_id UUID,
  uid UUID DEFAULT auth.uid(),
  min_role TEXT DEFAULT 'participant',
  active_only BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.youth_project_members pm
    WHERE pm.project_id = proj_id
      AND pm.user_id = uid
      AND (
        CASE
          WHEN active_only THEN pm.status = 'active'
          ELSE pm.status IN ('invited', 'active', 'completed')
        END
      )
      AND (
        min_role = 'participant'
        OR (min_role = 'coordinator' AND pm.role = 'coordinator')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.youth_can_access_project(
  proj_id UUID,
  uid UUID DEFAULT auth.uid(),
  min_org_role TEXT DEFAULT 'viewer'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.youth_projects p
    WHERE p.id = proj_id
      AND (
        p.created_by = uid
        OR (
          p.organization_id IS NOT NULL
          AND public.youth_is_org_member(p.organization_id, uid, min_org_role)
        )
      )
  );
$$;

DROP POLICY IF EXISTS youth_projects_select ON public.youth_projects;
CREATE POLICY youth_projects_select ON public.youth_projects
  FOR SELECT TO authenticated
  USING (
    status IN ('approved', 'active', 'completed')
    OR created_by = auth.uid()
    OR (organization_id IS NOT NULL AND public.youth_is_org_member(organization_id))
    OR public.youth_is_project_member(id)
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_pm_select ON public.youth_project_members;
CREATE POLICY youth_pm_select ON public.youth_project_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.youth_can_access_project(project_id)
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_pm_insert ON public.youth_project_members;
CREATE POLICY youth_pm_insert ON public.youth_project_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.youth_can_access_project(project_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_pm_update ON public.youth_project_members;
CREATE POLICY youth_pm_update ON public.youth_project_members
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.youth_can_access_project(project_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.youth_can_access_project(project_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_tasks_select ON public.youth_project_tasks;
CREATE POLICY youth_tasks_select ON public.youth_project_tasks
  FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.youth_is_project_member(project_id, auth.uid(), 'participant', true)
    OR public.youth_can_access_project(project_id)
    OR public.youth_is_platform_admin()
  );

DROP POLICY IF EXISTS youth_tasks_insert ON public.youth_project_tasks;
CREATE POLICY youth_tasks_insert ON public.youth_project_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.youth_is_project_member(project_id, auth.uid(), 'coordinator', true)
      OR public.youth_can_access_project(project_id, auth.uid(), 'coordinator')
      OR public.youth_is_platform_admin()
    )
  );

DROP POLICY IF EXISTS youth_tasks_update ON public.youth_project_tasks;
CREATE POLICY youth_tasks_update ON public.youth_project_tasks
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.youth_is_project_member(project_id, auth.uid(), 'coordinator', true)
    OR public.youth_can_access_project(project_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.youth_is_project_member(project_id, auth.uid(), 'coordinator', true)
    OR public.youth_can_access_project(project_id, auth.uid(), 'coordinator')
    OR public.youth_is_platform_admin()
  );
