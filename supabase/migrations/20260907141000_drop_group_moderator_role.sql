-- Drop leftover moderator role. Anyone still stored as moderator becomes a member.

UPDATE public.group_memberships
SET role = 'member'
WHERE role = 'moderator';

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.group_memberships'::regclass
      AND con.contype = 'c'
      AND att.attname = 'role'
  LOOP
    EXECUTE format('ALTER TABLE public.group_memberships DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.group_memberships
  ADD CONSTRAINT group_memberships_role_check
  CHECK (role IN ('admin', 'co_admin', 'manager', 'member'));
