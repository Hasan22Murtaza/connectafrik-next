-- Admin moderation actions + grouped view for chat user reports.

CREATE TABLE IF NOT EXISTS public.chat_user_report_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'dismiss',
    'warn_user',
    'suspend_user'
  )),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_user_report_actions_thread_id
  ON public.chat_user_report_actions (thread_id, created_at DESC);

ALTER TABLE public.chat_user_report_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_user_report_actions_no_select ON public.chat_user_report_actions;
DROP POLICY IF EXISTS chat_user_report_actions_no_insert ON public.chat_user_report_actions;
DROP POLICY IF EXISTS chat_user_report_actions_no_update ON public.chat_user_report_actions;
DROP POLICY IF EXISTS chat_user_report_actions_no_delete ON public.chat_user_report_actions;

CREATE POLICY chat_user_report_actions_no_select ON public.chat_user_report_actions
  FOR SELECT USING (false);
CREATE POLICY chat_user_report_actions_no_insert ON public.chat_user_report_actions
  FOR INSERT WITH CHECK (false);
CREATE POLICY chat_user_report_actions_no_update ON public.chat_user_report_actions
  FOR UPDATE USING (false);
CREATE POLICY chat_user_report_actions_no_delete ON public.chat_user_report_actions
  FOR DELETE USING (false);

REVOKE ALL ON public.chat_user_report_actions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.chat_user_report_actions TO service_role;

CREATE OR REPLACE VIEW public.chat_user_report_groups AS
SELECT
  g.thread_id,
  g.reported_user_id,
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
    cur.thread_id,
    (array_agg(cur.reported_user_id ORDER BY cur.created_at DESC))[1] AS reported_user_id,
    count(*)::int AS report_count,
    min(cur.created_at) AS first_reported_at,
    max(cur.created_at) AS last_reported_at,
    (array_agg(cur.id ORDER BY cur.created_at DESC))[1] AS latest_report_id,
    (array_agg(cur.reason ORDER BY cur.created_at DESC))[1] AS latest_reason,
    (array_agg(cur.reported_by ORDER BY cur.created_at DESC))[1] AS latest_reporter_id,
    CASE
      WHEN bool_or(cur.status = 'pending') THEN 'pending'
      WHEN bool_or(cur.status = 'under_review') THEN 'under_review'
      WHEN bool_or(cur.status = 'resolved') THEN 'resolved'
      ELSE 'dismissed'
    END AS status
  FROM public.chat_user_reports cur
  GROUP BY cur.thread_id
) g
LEFT JOIN (
  SELECT
    r.thread_id,
    jsonb_object_agg(r.reason, r.cnt) AS reason_counts
  FROM (
    SELECT thread_id, reason, count(*)::int AS cnt
    FROM public.chat_user_reports
    GROUP BY thread_id, reason
  ) r
  GROUP BY r.thread_id
) rc ON rc.thread_id = g.thread_id;

ALTER VIEW public.chat_user_report_groups SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.search_reported_chat_thread_ids(p_query text)
RETURNS TABLE (thread_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT nullif(trim(p_query), '') AS q
  )
  SELECT DISTINCT cur.thread_id
  FROM public.chat_user_reports cur
  LEFT JOIN public.profiles reported ON reported.id = cur.reported_user_id
  LEFT JOIN public.profiles reporter ON reporter.id = cur.reported_by
  CROSS JOIN q
  WHERE q.q IS NOT NULL
    AND (
      cur.thread_id::text ILIKE q.q || '%'
      OR cur.reported_user_id::text ILIKE q.q || '%'
      OR coalesce(reported.username, '') ILIKE '%' || q.q || '%'
      OR coalesce(reported.full_name, '') ILIKE '%' || q.q || '%'
      OR coalesce(reporter.username, '') ILIKE '%' || q.q || '%'
      OR coalesce(reporter.full_name, '') ILIKE '%' || q.q || '%'
      OR coalesce(cur.notes, '') ILIKE '%' || q.q || '%'
    );
$$;

REVOKE ALL ON FUNCTION public.search_reported_chat_thread_ids(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_reported_chat_thread_ids(text) TO service_role;

COMMENT ON TABLE public.chat_user_report_actions IS
  'Admin moderation actions taken on chat user report groups.';
COMMENT ON VIEW public.chat_user_report_groups IS
  'One row per reported chat thread for the admin queue.';
