-- Drop title from public.posts; content-only posts (aligned with app composer).
-- 1) Preserve existing data by merging title into content where title was set.
UPDATE public.posts
SET content = CASE
  WHEN coalesce(trim(title), '') = '' THEN content
  WHEN coalesce(trim(content), '') = '' THEN coalesce(trim(title), '')
  ELSE trim(title) || E'\n\n' || trim(content)
END
WHERE coalesce(trim(title), '') <> '';

-- View(s) that select from posts.title must be dropped before the column can be removed.
DROP VIEW IF EXISTS public.posts_with_reactions;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_title_check;

DROP INDEX IF EXISTS public.idx_posts_content_search;

CREATE INDEX IF NOT EXISTS idx_posts_content_search ON public.posts USING gin (
  to_tsvector('english'::regconfig, content)
);

ALTER TABLE public.posts DROP COLUMN IF EXISTS title;

-- Recreate posts_with_reactions if you still need it (omit title; use content for previews).
-- Example: CREATE VIEW public.posts_with_reactions AS SELECT ... FROM public.posts p ...;
