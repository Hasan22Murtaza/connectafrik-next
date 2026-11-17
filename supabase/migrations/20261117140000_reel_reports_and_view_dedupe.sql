-- Reel reports (mirror post_reports) + dedupe reel_views per user.
-- Safe, data-preserving. Does not drop existing reel data.

-- ---------------------------------------------------------------------------
-- 1) Deduplicate reel_views (keep earliest row per user + reel)
-- ---------------------------------------------------------------------------
DELETE FROM public.reel_views a
USING public.reel_views b
WHERE a.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.reel_id = b.reel_id
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS reel_views_unique_user_reel
  ON public.reel_views (user_id, reel_id)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) reel_reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reel_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'sexual_content',
    'violent_or_repulsive',
    'hateful_or_abusive',
    'harmful_or_dangerous',
    'spam_or_misleading',
    'child_abuse'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'under_review',
    'resolved',
    'dismissed'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS reel_reports_unique_user_reason
  ON public.reel_reports (reel_id, reported_by, reason)
  WHERE reported_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reel_reports_reel_id
  ON public.reel_reports (reel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reel_reports_status_created
  ON public.reel_reports (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_reel_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reel_reports_updated_at ON public.reel_reports;
CREATE TRIGGER trg_reel_reports_updated_at
  BEFORE UPDATE ON public.reel_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reel_reports_updated_at();

ALTER TABLE public.reel_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reel_reports_deny_all ON public.reel_reports;
CREATE POLICY reel_reports_deny_all ON public.reel_reports
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 3) Feed / engagement helper indexes (IF NOT EXISTS)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS reels_public_engagement_idx
  ON public.reels (engagement_score DESC, created_at DESC)
  WHERE is_deleted = false AND is_public = true;

CREATE INDEX IF NOT EXISTS reel_comments_reel_parent_created_idx
  ON public.reel_comments (reel_id, parent_id, created_at ASC)
  WHERE is_deleted = false;
