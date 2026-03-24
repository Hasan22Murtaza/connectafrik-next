-- Signaling fields and RLS for call_sessions (table assumed to exist)
ALTER TABLE public.call_sessions
  ADD COLUMN IF NOT EXISTS room_id text,
  ADD COLUMN IF NOT EXISTS call_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_call_sessions_thread_call_id
  ON public.call_sessions (thread_id, call_id);

CREATE INDEX IF NOT EXISTS idx_call_sessions_thread_updated
  ON public.call_sessions (thread_id, updated_at DESC);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS call_sessions_select ON public.call_sessions;
CREATE POLICY call_sessions_select ON public.call_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.thread_id = call_sessions.thread_id
        AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS call_sessions_insert ON public.call_sessions;
CREATE POLICY call_sessions_insert ON public.call_sessions
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.thread_id = call_sessions.thread_id
        AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS call_sessions_update ON public.call_sessions;
CREATE POLICY call_sessions_update ON public.call_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.thread_id = call_sessions.thread_id
        AND cp.user_id = auth.uid()
    )
  );

-- Deliver INSERT/UPDATE to clients (incoming call + hang-up). Safe if already added.
DO $pub$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$pub$;
