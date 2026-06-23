-- Text-post decorative backgrounds for group posts (Facebook-style); null = default layout.
ALTER TABLE public.group_posts
  ADD COLUMN IF NOT EXISTS background_id text;

COMMENT ON COLUMN public.group_posts.background_id IS 'Preset id for text-only group post backgrounds (see app constants postBackgrounds).';
