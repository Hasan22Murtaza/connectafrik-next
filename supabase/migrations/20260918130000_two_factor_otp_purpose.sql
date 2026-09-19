-- Allow email OTPs for two-factor authentication (sign-in and enabling 2FA).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.auth_email_otps'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%purpose%'
  LOOP
    EXECUTE format('ALTER TABLE public.auth_email_otps DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.auth_email_otps
  ADD CONSTRAINT auth_email_otps_purpose_check
  CHECK (purpose IN ('signup', 'login', 'recovery', 'two_factor'));
