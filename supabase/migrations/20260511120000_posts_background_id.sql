-- Text-post decorative backgrounds (Facebook-style); null = default layout.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS background_id text;

COMMENT ON COLUMN public.posts.background_id IS 'Preset id for text-only post backgrounds (see app constants postBackgrounds).';
