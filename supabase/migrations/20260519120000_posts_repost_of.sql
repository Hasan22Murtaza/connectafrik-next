-- Facebook-style reposts: a feed post can reference an original post.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS repost_of_id uuid REFERENCES public.posts (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS posts_repost_of_id_idx
  ON public.posts (repost_of_id)
  WHERE repost_of_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS posts_author_repost_of_id_unique
  ON public.posts (author_id, repost_of_id)
  WHERE repost_of_id IS NOT NULL AND is_deleted = false;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_content_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_content_check CHECK (
    length(content) <= 5000
    AND (
      repost_of_id IS NOT NULL
      OR length(content) >= 10
      OR cardinality(coalesce(media_urls, '{}'::text[])) > 0
    )
  );
