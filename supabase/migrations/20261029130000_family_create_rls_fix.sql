-- Fix family create bootstrap RLS.
-- INSERT ... RETURNING requires SELECT policy to allow the new row.
-- Previously SELECT only allowed active members, so create failed before
-- the parent membership row existed.

DROP POLICY IF EXISTS families_select_member ON public.families;
CREATE POLICY families_select_member ON public.families
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.family_is_active_member(id, auth.uid())
  );

-- Allow the creator to read their own bootstrap membership immediately.
DROP POLICY IF EXISTS family_members_select_same_family ON public.family_members;
CREATE POLICY family_members_select_same_family ON public.family_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.family_is_active_member(family_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.families f
      WHERE f.id = family_id
        AND f.created_by = auth.uid()
    )
  );
