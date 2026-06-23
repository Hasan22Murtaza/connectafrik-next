-- Track shares of group posts and a denormalized count on the post

ALTER TABLE public.group_posts
  ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.group_post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_post_id uuid NOT NULL REFERENCES public.group_posts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  share_type text NOT NULL DEFAULT 'internal',
  platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_post_shares_group_post_id_idx
  ON public.group_post_shares (group_post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS group_post_shares_user_id_idx
  ON public.group_post_shares (user_id, created_at DESC);

ALTER TABLE public.group_post_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_post_shares_select_all" ON public.group_post_shares
  FOR SELECT USING (true);

CREATE POLICY "group_post_shares_insert_own" ON public.group_post_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "group_post_shares_delete_own" ON public.group_post_shares
  FOR DELETE USING (auth.uid() = user_id);
