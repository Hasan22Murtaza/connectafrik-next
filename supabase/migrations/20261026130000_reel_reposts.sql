-- Reel reposts: toggleable bookmarks of reels onto the user's Reposted library (same pattern as reel_saves)

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS reposts_count integer NOT NULL DEFAULT 0;

UPDATE public.reels SET reposts_count = 0 WHERE reposts_count IS NULL;

CREATE TABLE IF NOT EXISTS public.reel_reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reel_id uuid NOT NULL REFERENCES public.reels (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_reel_repost UNIQUE (user_id, reel_id)
);

CREATE INDEX IF NOT EXISTS reel_reposts_user_created_idx
  ON public.reel_reposts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reel_reposts_reel_created_idx
  ON public.reel_reposts (reel_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.reel_reposts_sync_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
BEGIN
  PERFORM set_config('reels.counter_sync', 'on', true);
  rid := COALESCE(NEW.reel_id, OLD.reel_id);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET reposts_count = GREATEST(COALESCE(reposts_count, 0) + 1, 0) WHERE id = rid;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET reposts_count = GREATEST(COALESCE(reposts_count, 0) - 1, 0) WHERE id = rid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS reel_reposts_counter_trigger ON public.reel_reposts;
CREATE TRIGGER reel_reposts_counter_trigger
  AFTER INSERT OR DELETE ON public.reel_reposts
  FOR EACH ROW EXECUTE FUNCTION public.reel_reposts_sync_counter();

-- Protect derived counter from client updates (extend existing guard if present)
CREATE OR REPLACE FUNCTION public.reels_protect_derived_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('reels.counter_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.likes_count := OLD.likes_count;
  NEW.comments_count := OLD.comments_count;
  NEW.shares_count := OLD.shares_count;
  NEW.views_count := OLD.views_count;
  NEW.saves_count := OLD.saves_count;
  NEW.reposts_count := OLD.reposts_count;
  NEW.engagement_score := OLD.engagement_score;
  RETURN NEW;
END;
$$;

ALTER TABLE public.reel_reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reel_reposts_select_own ON public.reel_reposts;
CREATE POLICY reel_reposts_select_own ON public.reel_reposts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS reel_reposts_insert_own ON public.reel_reposts;
CREATE POLICY reel_reposts_insert_own ON public.reel_reposts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS reel_reposts_delete_own ON public.reel_reposts;
CREATE POLICY reel_reposts_delete_own ON public.reel_reposts
  FOR DELETE TO authenticated USING (user_id = auth.uid());
