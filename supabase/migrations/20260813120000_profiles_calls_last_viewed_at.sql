ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calls_last_viewed_at timestamptz;

COMMENT ON COLUMN public.profiles.calls_last_viewed_at IS
  'When the user last opened the header Calls menu; missed-call badge counts sessions after this time.';
