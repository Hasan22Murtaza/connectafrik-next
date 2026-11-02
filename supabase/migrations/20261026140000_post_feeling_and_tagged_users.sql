-- Post feeling (Facebook-style "is feeling …") and people tags

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS feeling jsonb NULL;

COMMENT ON COLUMN public.posts.feeling IS
  'Optional feeling/activity for the post: { "emoji": "😊", "label": "Happy" }.';

CREATE TABLE IF NOT EXISTS public.post_tagged_users (
  post_id uuid NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_tagged_users_user_id_created_at_idx
  ON public.post_tagged_users (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_tagged_users_post_id_idx
  ON public.post_tagged_users (post_id);

ALTER TABLE public.post_tagged_users ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the post can see its tags (RLS on posts already gates visibility).
DROP POLICY IF EXISTS post_tagged_users_select ON public.post_tagged_users;
CREATE POLICY post_tagged_users_select ON public.post_tagged_users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND COALESCE(p.is_deleted, false) = false
        AND public.privacy_can_view_post(auth.uid(), p.id)
    )
  );

DROP POLICY IF EXISTS post_tagged_users_insert ON public.post_tagged_users;
CREATE POLICY post_tagged_users_insert ON public.post_tagged_users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND p.author_id = auth.uid()
        AND COALESCE(p.is_deleted, false) = false
    )
    AND user_id <> auth.uid()
  );

DROP POLICY IF EXISTS post_tagged_users_delete ON public.post_tagged_users;
CREATE POLICY post_tagged_users_delete ON public.post_tagged_users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND p.author_id = auth.uid()
    )
  );
