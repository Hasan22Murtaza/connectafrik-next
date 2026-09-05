-- Post reporting (users) + moderation actions (admins).
-- Direct client access is denied; all reads/writes go through service-role API routes.

CREATE TABLE IF NOT EXISTS public.post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS post_reports_unique_user_reason
  ON public.post_reports (post_id, reported_by, reason)
  WHERE reported_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_reports_post_id
  ON public.post_reports (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_reports_status_created
  ON public.post_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_reports_reason_created
  ON public.post_reports (reason, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_reports_reported_by
  ON public.post_reports (reported_by)
  WHERE reported_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.post_report_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'keep_post',
    'remove_post',
    'warn_user',
    'suspend_user'
  )),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_report_actions_post_id
  ON public.post_report_actions (post_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_post_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_reports_updated_at ON public.post_reports;
CREATE TRIGGER trg_post_reports_updated_at
  BEFORE UPDATE ON public.post_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_post_reports_updated_at();

-- Grouped view: one row per reported post for the admin queue.
CREATE OR REPLACE VIEW public.post_report_groups AS
SELECT
  g.post_id,
  g.author_id,
  g.report_count,
  g.first_reported_at,
  g.last_reported_at,
  g.latest_report_id,
  g.latest_reason,
  g.latest_reporter_id,
  g.status,
  COALESCE(rc.reason_counts, '{}'::jsonb) AS reason_counts
FROM (
  SELECT
    pr.post_id,
    p.author_id,
    count(*)::int AS report_count,
    min(pr.created_at) AS first_reported_at,
    max(pr.created_at) AS last_reported_at,
    (array_agg(pr.id ORDER BY pr.created_at DESC))[1] AS latest_report_id,
    (array_agg(pr.reason ORDER BY pr.created_at DESC))[1] AS latest_reason,
    (array_agg(pr.reported_by ORDER BY pr.created_at DESC))[1] AS latest_reporter_id,
    CASE
      WHEN bool_or(pr.status = 'pending') THEN 'pending'
      WHEN bool_or(pr.status = 'under_review') THEN 'under_review'
      WHEN bool_or(pr.status = 'resolved') THEN 'resolved'
      ELSE 'dismissed'
    END AS status
  FROM public.post_reports pr
  JOIN public.posts p ON p.id = pr.post_id
  GROUP BY pr.post_id, p.author_id
) g
LEFT JOIN (
  SELECT
    r.post_id,
    jsonb_object_agg(r.reason, r.cnt) AS reason_counts
  FROM (
    SELECT post_id, reason, count(*)::int AS cnt
    FROM public.post_reports
    GROUP BY post_id, reason
  ) r
  GROUP BY r.post_id
) rc ON rc.post_id = g.post_id;

ALTER VIEW public.post_report_groups SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.search_reported_post_ids(p_query text)
RETURNS TABLE (post_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT nullif(trim(p_query), '') AS q
  )
  SELECT DISTINCT pr.post_id
  FROM public.post_reports pr
  JOIN public.posts p ON p.id = pr.post_id
  LEFT JOIN public.profiles author ON author.id = p.author_id
  LEFT JOIN public.profiles reporter ON reporter.id = pr.reported_by
  CROSS JOIN q
  WHERE q.q IS NOT NULL
    AND (
      p.id::text ILIKE q.q || '%'
      OR coalesce(p.content, '') ILIKE '%' || q.q || '%'
      OR coalesce(author.username, '') ILIKE '%' || q.q || '%'
      OR coalesce(author.full_name, '') ILIKE '%' || q.q || '%'
      OR coalesce(reporter.username, '') ILIKE '%' || q.q || '%'
      OR coalesce(reporter.full_name, '') ILIKE '%' || q.q || '%'
    );
$$;

REVOKE ALL ON FUNCTION public.search_reported_post_ids(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_reported_post_ids(text) TO service_role;

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_report_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_reports_no_select ON public.post_reports;
DROP POLICY IF EXISTS post_reports_no_insert ON public.post_reports;
DROP POLICY IF EXISTS post_reports_no_update ON public.post_reports;
DROP POLICY IF EXISTS post_reports_no_delete ON public.post_reports;

CREATE POLICY post_reports_no_select ON public.post_reports
  FOR SELECT USING (false);
CREATE POLICY post_reports_no_insert ON public.post_reports
  FOR INSERT WITH CHECK (false);
CREATE POLICY post_reports_no_update ON public.post_reports
  FOR UPDATE USING (false);
CREATE POLICY post_reports_no_delete ON public.post_reports
  FOR DELETE USING (false);

DROP POLICY IF EXISTS post_report_actions_no_select ON public.post_report_actions;
DROP POLICY IF EXISTS post_report_actions_no_insert ON public.post_report_actions;
DROP POLICY IF EXISTS post_report_actions_no_update ON public.post_report_actions;
DROP POLICY IF EXISTS post_report_actions_no_delete ON public.post_report_actions;

CREATE POLICY post_report_actions_no_select ON public.post_report_actions
  FOR SELECT USING (false);
CREATE POLICY post_report_actions_no_insert ON public.post_report_actions
  FOR INSERT WITH CHECK (false);
CREATE POLICY post_report_actions_no_update ON public.post_report_actions
  FOR UPDATE USING (false);
CREATE POLICY post_report_actions_no_delete ON public.post_report_actions
  FOR DELETE USING (false);

REVOKE ALL ON public.post_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.post_report_actions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.post_report_groups FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.post_reports TO service_role;
GRANT ALL ON public.post_report_actions TO service_role;
GRANT SELECT ON public.post_report_groups TO service_role;

COMMENT ON TABLE public.post_reports IS
  'User-submitted post reports. Clients cannot read or write directly; service-role APIs only.';
COMMENT ON TABLE public.post_report_actions IS
  'Admin moderation actions taken against reported posts.';
COMMENT ON VIEW public.post_report_groups IS
  'One row per reported post with aggregate counts for the admin reports queue.';
