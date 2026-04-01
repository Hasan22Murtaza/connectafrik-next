-- Text stories use media_type = 'text' (see app/api/stories/route.ts).
-- Extend the check constraint so inserts no longer fail.

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_media_type_check;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_media_type_check
  CHECK (media_type IN ('image', 'video', 'text'));
