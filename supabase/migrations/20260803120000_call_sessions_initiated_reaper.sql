-- Reaper for call_sessions stuck in `initiated`.
--
-- cleanup_stale_ringing_call_sessions (20260708120000) only ever filtered
-- WHERE status = 'ringing'. A session that fails between INSERT and the
-- ringing transition -- or any future code path that inserts directly at
-- `initiated` -- stays there forever. That matters because the busy check
-- (lib/call-media/session-busy.ts) treats initiated/ringing/active as ACTIVE
-- for a 4-hour window, so one stranded `initiated` row would make a user
-- appear permanently busy and unable to receive calls for 4 hours.

CREATE OR REPLACE FUNCTION public.cleanup_stale_initiated_call_sessions(
  p_timeout_seconds int DEFAULT 55,
  p_batch_size int DEFAULT 1000
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH cte AS (
    SELECT id
    FROM public.call_sessions
    WHERE status = 'initiated'
      AND created_at <= now() - make_interval(secs => p_timeout_seconds)
    ORDER BY created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.call_sessions cs
  SET
    status = 'missed',
    ended_at = now(),
    updated_at = now(),
    metadata = COALESCE(cs.metadata, '{}'::jsonb) || jsonb_build_object('last_signal', 'missed', 'reapedBy', 'initiated_reaper')
  FROM cte
  WHERE cs.id = cte.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_initiated_call_sessions(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_initiated_call_sessions(int, int) TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'cleanup-stale-initiated-calls';

    PERFORM cron.schedule(
      'cleanup-stale-initiated-calls',
      '* * * * *',
      $$SELECT public.cleanup_stale_initiated_call_sessions(55, 1000)$$
    );
  END IF;
END
$cron$;
