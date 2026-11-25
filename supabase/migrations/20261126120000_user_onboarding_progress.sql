-- User onboarding progress for guided tours (GSCH, Youth Leadership, etc.)
-- Additive only. Users can only read/write their own rows.

CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('gsch', 'youth_leadership')),
  screen_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    status IN ('not_started', 'completed', 'skipped')
  ),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_onboarding_progress_user_module_screen_unique
    UNIQUE (user_id, module, screen_key)
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_user_module
  ON public.user_onboarding_progress (user_id, module);

DROP TRIGGER IF EXISTS trg_user_onboarding_progress_updated_at
  ON public.user_onboarding_progress;
CREATE TRIGGER trg_user_onboarding_progress_updated_at
  BEFORE UPDATE ON public.user_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_onboarding_progress_select ON public.user_onboarding_progress;
CREATE POLICY user_onboarding_progress_select ON public.user_onboarding_progress
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_onboarding_progress_insert ON public.user_onboarding_progress;
CREATE POLICY user_onboarding_progress_insert ON public.user_onboarding_progress
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_onboarding_progress_update ON public.user_onboarding_progress;
CREATE POLICY user_onboarding_progress_update ON public.user_onboarding_progress
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_onboarding_progress_delete ON public.user_onboarding_progress;
CREATE POLICY user_onboarding_progress_delete ON public.user_onboarding_progress
  FOR DELETE
  USING (user_id = auth.uid());
