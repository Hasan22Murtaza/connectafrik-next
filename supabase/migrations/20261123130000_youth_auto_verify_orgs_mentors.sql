-- Auto-approve youth organizations and mentors (no admin verification queue).
-- Platform admins can still reject/suspend afterward.

ALTER TABLE public.youth_organizations
  ALTER COLUMN verification_status SET DEFAULT 'verified';

ALTER TABLE public.youth_mentors
  ALTER COLUMN verification_status SET DEFAULT 'verified';

UPDATE public.youth_organizations
SET
  verification_status = 'verified',
  verified_at = COALESCE(verified_at, now()),
  verified_by = COALESCE(verified_by, created_by)
WHERE verification_status = 'pending';

UPDATE public.youth_mentors
SET
  verification_status = 'verified',
  verified_at = COALESCE(verified_at, now()),
  verified_by = COALESCE(verified_by, user_id)
WHERE verification_status = 'pending';
