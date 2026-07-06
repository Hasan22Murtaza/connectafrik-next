-- Email OTP storage for signup, login verification, and password recovery
CREATE TABLE IF NOT EXISTS public.auth_email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  otp_hash text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signup', 'login', 'recovery')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts int NOT NULL DEFAULT 0,
  resend_count int NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_email_otps_email_purpose_created
  ON public.auth_email_otps (lower(email), purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_email_otps_expires_at
  ON public.auth_email_otps (expires_at);

-- Service-role helpers for auth user lookups (no direct auth.users access from app code)
CREATE OR REPLACE FUNCTION public.auth_user_by_email(check_email text)
RETURNS TABLE (id uuid, email_confirmed_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT u.id, u.email_confirmed_at
  FROM auth.users u
  WHERE lower(u.email) = lower(check_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_by_email(text) TO service_role;
