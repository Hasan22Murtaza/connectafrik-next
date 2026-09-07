-- Allow group_memberships.status = 'invited' for friend invites that
-- have not been accepted yet (distinct from join-request 'pending').

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.group_memberships'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.group_memberships DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.group_memberships
  ADD CONSTRAINT group_memberships_status_check
  CHECK (status IN ('active', 'pending', 'banned', 'left', 'rejected', 'invited'));
