-- Call session heartbeat: detect stale "active" calls when clients crash or lose network.
-- Requires pg_cron (enabled by default on Supabase). Schedule via Dashboard if this block fails locally.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.call_sessions
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

COMMENT ON COLUMN public.call_sessions.last_heartbeat_at IS
  'Last liveness ping from any in-call participant while status = active. Used by pg_cron to end ghost calls.';

-- Backfill active rows so existing calls are not immediately timed out after deploy.
UPDATE public.call_sessions
SET last_heartbeat_at = COALESCE(updated_at, started_at, created_at, now())
WHERE status = 'active'
  AND last_heartbeat_at IS NULL;

-- Partial indexes: only index live rows → stays small at millions of historical calls.
CREATE INDEX IF NOT EXISTS idx_call_sessions_active_stale_heartbeat
  ON public.call_sessions (last_heartbeat_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_call_sessions_ringing_started
  ON public.call_sessions (started_at)
  WHERE status = 'ringing';

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.call_session_user_is_participant(
  p_created_by uuid,
  p_participants uuid[],
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND (
      p_created_by = p_user_id
      OR (p_participants IS NOT NULL AND p_user_id = ANY(p_participants))
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Heartbeat (callable by authenticated clients via PostgREST / supabase.rpc)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.call_session_heartbeat(
  p_thread_id uuid,
  p_call_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_participants cp
    WHERE cp.thread_id = p_thread_id
      AND cp.user_id = v_uid
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.call_sessions cs
  SET
    last_heartbeat_at = now(),
    updated_at = now(),
    metadata = COALESCE(cs.metadata, '{}'::jsonb) || jsonb_build_object(
      'last_signal', 'heartbeat',
      'last_heartbeat_by', v_uid::text,
      'last_heartbeat_at', to_jsonb(now())
    )
  WHERE cs.thread_id = p_thread_id
    AND cs.call_id = p_call_id
    AND cs.status = 'active'
    AND public.call_session_user_is_participant(cs.created_by, cs.participants, v_uid);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.call_session_heartbeat(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.call_session_heartbeat(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Accept / end SQL (for direct RPC or reference; API routes mirror this logic)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.call_session_accept(
  p_thread_id uuid,
  p_call_id text
)
RETURNS public.call_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.call_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.call_sessions cs
  SET
    status = 'active',
    last_heartbeat_at = now(),
    updated_at = now(),
    participants = (
      CASE
        WHEN cs.participants IS NULL THEN ARRAY[v_uid]::uuid[]
        WHEN NOT (v_uid = ANY(cs.participants)) THEN array_append(cs.participants, v_uid)
        ELSE cs.participants
      END
    ),
    metadata = COALESCE(cs.metadata, '{}'::jsonb) || jsonb_build_object(
      'acceptedBy', v_uid::text,
      'acceptedAt', to_jsonb(now()),
      'last_signal', 'active'
    )
  WHERE cs.thread_id = p_thread_id
    AND cs.call_id = p_call_id
    AND cs.status IN ('initiated', 'ringing', 'active')
    AND EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.thread_id = p_thread_id
        AND cp.user_id = v_uid
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'call session not found or not acceptable' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.call_session_accept(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.call_session_accept(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.call_session_end(
  p_thread_id uuid,
  p_call_id text,
  p_duration_seconds int DEFAULT NULL
)
RETURNS public.call_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.call_sessions;
  v_duration int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.call_sessions cs
  SET
    status = 'ended',
    ended_at = now(),
    duration_seconds = COALESCE(
      p_duration_seconds,
      GREATEST(
        0,
        EXTRACT(EPOCH FROM (now() - COALESCE(cs.started_at, cs.created_at)))::int
      )
    ),
    updated_at = now(),
    metadata = COALESCE(cs.metadata, '{}'::jsonb) || jsonb_build_object(
      'endedBy', v_uid::text,
      'endedAt', to_jsonb(now()),
      'last_signal', 'ended'
    )
  WHERE cs.thread_id = p_thread_id
    AND cs.call_id = p_call_id
    AND cs.status IN ('initiated', 'ringing', 'active')
    AND public.call_session_user_is_participant(cs.created_by, cs.participants, v_uid)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'call session not found or not endable' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.call_session_end(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.call_session_end(uuid, text, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Cron cleanup (service_role only — invoked by pg_cron, not clients)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_stale_ringing_call_sessions(
  p_ring_timeout_seconds int DEFAULT 55,
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
    WHERE status = 'ringing'
      AND started_at <= now() - make_interval(secs => p_ring_timeout_seconds)
    ORDER BY started_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.call_sessions cs
  SET
    status = 'ended',
    ended_at = now(),
    updated_at = now(),
    metadata = COALESCE(cs.metadata, '{}'::jsonb) || jsonb_build_object('last_signal', 'ring_timeout')
  FROM cte
  WHERE cs.id = cte.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_stale_active_call_sessions(
  p_heartbeat_timeout_seconds int DEFAULT 90,
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
    WHERE status = 'active'
      AND last_heartbeat_at IS NOT NULL
      AND last_heartbeat_at <= now() - make_interval(secs => p_heartbeat_timeout_seconds)
    ORDER BY last_heartbeat_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.call_sessions cs
  SET
    status = 'ended',
    ended_at = now(),
    duration_seconds = GREATEST(
      0,
      EXTRACT(EPOCH FROM (now() - COALESCE(cs.started_at, cs.created_at)))::int
    ),
    updated_at = now(),
    metadata = COALESCE(cs.metadata, '{}'::jsonb) || jsonb_build_object('last_signal', 'heartbeat_timeout')
  FROM cte
  WHERE cs.id = cte.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_ringing_call_sessions(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_stale_active_call_sessions(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_ringing_call_sessions(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_active_call_sessions(int, int) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. pg_cron schedules (every minute, batched)
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'cleanup-stale-ringing-calls',
      'cleanup-stale-active-calls'
    );

    PERFORM cron.schedule(
      'cleanup-stale-ringing-calls',
      '* * * * *',
      $$SELECT public.cleanup_stale_ringing_call_sessions(55, 1000)$$
    );

    PERFORM cron.schedule(
      'cleanup-stale-active-calls',
      '* * * * *',
      $$SELECT public.cleanup_stale_active_call_sessions(90, 1000)$$
    );
  END IF;
END
$cron$;

-- ---------------------------------------------------------------------------
-- 7. RLS — heartbeat updates only for in-call participants on active sessions
--     (direct table UPDATE; prefer call_session_heartbeat RPC from mobile clients)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS call_sessions_heartbeat_update ON public.call_sessions;
CREATE POLICY call_sessions_heartbeat_update ON public.call_sessions
  FOR UPDATE
  USING (
    status = 'active'
    AND public.call_session_user_is_participant(
      created_by,
      participants,
      auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.thread_id = call_sessions.thread_id
        AND cp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'active'
    AND public.call_session_user_is_participant(
      created_by,
      participants,
      auth.uid()
    )
  );

-- Only service_role (API) and security-definer RPC may set last_heartbeat_at directly.
REVOKE UPDATE (last_heartbeat_at) ON public.call_sessions FROM authenticated;
GRANT UPDATE (last_heartbeat_at) ON public.call_sessions TO service_role;
