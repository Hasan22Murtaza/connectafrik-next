-- Persisted bookmarks for feed posts (Saved Items → Posts tab)

CREATE TABLE IF NOT EXISTS public.post_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS post_saves_user_id_created_at_idx
  ON public.post_saves (user_id, created_at DESC);

ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_saves_select_own" ON public.post_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "post_saves_insert_own" ON public.post_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_saves_delete_own" ON public.post_saves
  FOR DELETE USING (auth.uid() = user_id);
