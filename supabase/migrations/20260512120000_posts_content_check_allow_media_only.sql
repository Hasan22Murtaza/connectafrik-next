-- Allow short or empty captions when the post includes media (photo/video).
-- Text-only posts still require at least 10 characters (matches app + API).

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_content_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_content_check CHECK (
    length(content) <= 5000
    AND (
      length(content) >= 10
      OR cardinality(coalesce(media_urls, '{}'::text[])) > 0
    )
  );
