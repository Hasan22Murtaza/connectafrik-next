CREATE TABLE IF NOT EXISTS public.chat_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads (id) ON DELETE CASCADE,
  generated_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content text NOT NULL,
  source_message_count integer NOT NULL DEFAULT 0,
  source_last_message_at timestamptz,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id)
);

CREATE INDEX IF NOT EXISTS chat_transcripts_thread_id_idx
  ON public.chat_transcripts (thread_id);

ALTER TABLE public.chat_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_transcripts_select_participant" ON public.chat_transcripts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.thread_id = chat_transcripts.thread_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_transcripts_insert_own" ON public.chat_transcripts
  FOR INSERT WITH CHECK (auth.uid() = generated_by);

CREATE POLICY "chat_transcripts_update_own" ON public.chat_transcripts
  FOR UPDATE USING (auth.uid() = generated_by)
  WITH CHECK (auth.uid() = generated_by);
