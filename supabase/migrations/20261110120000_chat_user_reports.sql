-- Chat user reporting (DM / 1:1). Direct client access is denied; API uses service role.

CREATE TABLE IF NOT EXISTS public.chat_user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'sexual_content',
    'violent_or_repulsive',
    'hateful_or_abusive',
    'harmful_or_dangerous',
    'spam_or_misleading',
    'child_abuse'
  )),
  notes TEXT,
  message_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'under_review',
    'resolved',
    'dismissed'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT chat_user_reports_notes_length CHECK (
    notes IS NULL OR char_length(notes) <= 2000
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_user_reports_unique_user_reason
  ON public.chat_user_reports (thread_id, reported_by, reason)
  WHERE reported_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_user_reports_thread_id
  ON public.chat_user_reports (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_user_reports_reported_user
  ON public.chat_user_reports (reported_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_user_reports_status_created
  ON public.chat_user_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_user_reports_reported_by
  ON public.chat_user_reports (reported_by)
  WHERE reported_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_chat_user_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_user_reports_updated_at ON public.chat_user_reports;
CREATE TRIGGER trg_chat_user_reports_updated_at
  BEFORE UPDATE ON public.chat_user_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_chat_user_reports_updated_at();

ALTER TABLE public.chat_user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_user_reports_no_select ON public.chat_user_reports;
DROP POLICY IF EXISTS chat_user_reports_no_insert ON public.chat_user_reports;
DROP POLICY IF EXISTS chat_user_reports_no_update ON public.chat_user_reports;
DROP POLICY IF EXISTS chat_user_reports_no_delete ON public.chat_user_reports;

CREATE POLICY chat_user_reports_no_select ON public.chat_user_reports
  FOR SELECT USING (false);
CREATE POLICY chat_user_reports_no_insert ON public.chat_user_reports
  FOR INSERT WITH CHECK (false);
CREATE POLICY chat_user_reports_no_update ON public.chat_user_reports
  FOR UPDATE USING (false);
CREATE POLICY chat_user_reports_no_delete ON public.chat_user_reports
  FOR DELETE USING (false);

REVOKE ALL ON public.chat_user_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.chat_user_reports TO service_role;

COMMENT ON TABLE public.chat_user_reports IS
  'User reports against another participant in a chat thread. Includes last-message snapshots for review.';
