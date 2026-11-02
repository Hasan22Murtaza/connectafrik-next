-- Per-post audience: public | friends | only_me

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

UPDATE public.posts
SET visibility = 'public'
WHERE visibility IS NULL;

ALTER TABLE public.posts
  ALTER COLUMN visibility SET DEFAULT 'public';

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_visibility_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_visibility_check CHECK (
    visibility = ANY (ARRAY['public'::text, 'friends'::text, 'only_me'::text])
  );

COMMENT ON COLUMN public.posts.visibility IS
  'Who can see this post: public (everyone), friends, only_me (author only).';

CREATE INDEX IF NOT EXISTS idx_posts_visibility
  ON public.posts USING btree (visibility)
  TABLESPACE pg_default
  WHERE (is_deleted = false);

-- Enforce per-post visibility in RLS (falls back to profile post_visibility for legacy nulls).
CREATE OR REPLACE FUNCTION public.privacy_can_view_post(viewer uuid, post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_id
      AND COALESCE(p.is_deleted, false) = false
      AND (
        p.author_id = viewer
        OR (
          NOT public.privacy_is_blocked(viewer, p.author_id)
          AND CASE COALESCE(
            NULLIF(p.visibility, ''),
            CASE COALESCE((SELECT pr.post_visibility FROM public.profiles pr WHERE pr.id = p.author_id), 'public')
              WHEN 'friends' THEN 'friends'
              WHEN 'private' THEN 'only_me'
              WHEN 'none' THEN 'only_me'
              ELSE 'public'
            END
          )
            WHEN 'public' THEN true
            WHEN 'everyone' THEN true
            WHEN 'friends' THEN viewer IS NOT NULL AND public.privacy_are_friends(viewer, p.author_id)
            -- Legacy value before rename private → friends
            WHEN 'private' THEN viewer IS NOT NULL AND public.privacy_are_friends(viewer, p.author_id)
            WHEN 'only_me' THEN false
            ELSE false
          END
        )
      )
  );
$$;
