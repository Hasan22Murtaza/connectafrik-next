-- One-way platform feedback: users submit, only admins review.

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  email TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'feature_request',
    'improvement_suggestion',
    'bug_report',
    'ui_ux_feedback',
    'general_feedback',
    'other'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  attachment_path TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new',
    'under_review',
    'planned',
    'in_progress',
    'completed',
    'rejected'
  )),
  internal_notes TEXT,
  admin_response TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feedback_title_length CHECK (char_length(trim(title)) BETWEEN 3 AND 200),
  CONSTRAINT feedback_message_length CHECK (char_length(trim(message)) BETWEEN 10 AND 5000),
  CONSTRAINT feedback_email_format CHECK (
    email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created
  ON public.feedback (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_type_created
  ON public.feedback (feedback_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id
  ON public.feedback (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON public.feedback (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_feedback_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_updated_at ON public.feedback;
CREATE TRIGGER trg_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.set_feedback_updated_at();

-- Deny all direct client access. Inserts/reads go through service-role API routes.
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_deny_all ON public.feedback;
-- Explicit deny-all for authenticated/anon (service role bypasses RLS).
CREATE POLICY feedback_no_select ON public.feedback
  FOR SELECT
  USING (false);

CREATE POLICY feedback_no_insert ON public.feedback
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY feedback_no_update ON public.feedback
  FOR UPDATE
  USING (false);

CREATE POLICY feedback_no_delete ON public.feedback
  FOR DELETE
  USING (false);

COMMENT ON TABLE public.feedback IS
  'One-way user feedback. Users cannot read submissions; only platform admins via service-role APIs.';
