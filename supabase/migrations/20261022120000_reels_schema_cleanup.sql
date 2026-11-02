-- =============================================================================
-- CribsTalk Reels schema cleanup
-- Safe, data-preserving refactor toward a simple TikTok-style model.
-- Does NOT drop tables or delete reel rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Helpers: drop CHECK constraints by table (keeps PK / UNIQUE / FK)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reels_drop_check_constraints(p_table regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = p_table
      AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', p_table, r.conname);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) Drop restrictive CHECKs (validation moves to the application layer)
-- Known live names (verified via probe) are included for clarity; the helper
-- also removes any other CHECK on these tables.
-- ---------------------------------------------------------------------------
SELECT public._reels_drop_check_constraints('public.reels'::regclass);
-- Explicit known names (no-op if already dropped by helper):
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_title_check;
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_description_check;
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_category_check;
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_aspect_ratio_check;
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_duration_check;
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_likes_count_check;
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_comments_count_check;
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_shares_count_check;
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_views_count_check;
ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_saves_count_check;

SELECT public._reels_drop_check_constraints('public.reel_shares'::regclass);
ALTER TABLE public.reel_shares DROP CONSTRAINT IF EXISTS reel_shares_share_type_check;

SELECT public._reels_drop_check_constraints('public.reel_views'::regclass);
ALTER TABLE public.reel_views DROP CONSTRAINT IF EXISTS reel_views_completion_rate_check;

SELECT public._reels_drop_check_constraints('public.reel_comments'::regclass);
ALTER TABLE public.reel_comments DROP CONSTRAINT IF EXISTS reel_comments_content_check;
ALTER TABLE public.reel_comments DROP CONSTRAINT IF EXISTS reel_comments_thread_depth_check;
ALTER TABLE public.reel_comments DROP CONSTRAINT IF EXISTS reel_comments_likes_count_check;
ALTER TABLE public.reel_comments DROP CONSTRAINT IF EXISTS reel_comments_replies_count_check;

SELECT public._reels_drop_check_constraints('public.reel_reactions'::regclass);

-- Keep content required at the column level (NOT NULL), not via length CHECK.
ALTER TABLE public.reel_comments
  ALTER COLUMN content SET NOT NULL,
  ALTER COLUMN reel_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Ensure engagement counters stay non-null with safe defaults
--    (no CHECK; triggers use GREATEST to avoid negatives)
-- ---------------------------------------------------------------------------
ALTER TABLE public.reels
  ALTER COLUMN likes_count SET DEFAULT 0,
  ALTER COLUMN comments_count SET DEFAULT 0,
  ALTER COLUMN shares_count SET DEFAULT 0,
  ALTER COLUMN views_count SET DEFAULT 0,
  ALTER COLUMN saves_count SET DEFAULT 0,
  ALTER COLUMN engagement_score SET DEFAULT 0,
  ALTER COLUMN is_public SET DEFAULT true,
  ALTER COLUMN is_featured SET DEFAULT false,
  ALTER COLUMN is_deleted SET DEFAULT false,
  ALTER COLUMN tags SET DEFAULT '{}';

UPDATE public.reels SET likes_count = 0 WHERE likes_count IS NULL;
UPDATE public.reels SET comments_count = 0 WHERE comments_count IS NULL;
UPDATE public.reels SET shares_count = 0 WHERE shares_count IS NULL;
UPDATE public.reels SET views_count = 0 WHERE views_count IS NULL;
UPDATE public.reels SET saves_count = 0 WHERE saves_count IS NULL;
UPDATE public.reels SET engagement_score = 0 WHERE engagement_score IS NULL;

ALTER TABLE public.reel_comments
  ALTER COLUMN likes_count SET DEFAULT 0,
  ALTER COLUMN replies_count SET DEFAULT 0,
  ALTER COLUMN thread_depth SET DEFAULT 0,
  ALTER COLUMN is_deleted SET DEFAULT false;

UPDATE public.reel_comments SET likes_count = 0 WHERE likes_count IS NULL;
UPDATE public.reel_comments SET replies_count = 0 WHERE replies_count IS NULL;

-- ---------------------------------------------------------------------------
-- 3) reel_comment_likes.user_id → profiles.id (was missing)
-- ---------------------------------------------------------------------------
-- Remove orphan likes that would block the FK.
DELETE FROM public.reel_comment_likes rcl
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = rcl.user_id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reel_comment_likes_user_id_fkey'
      AND conrelid = 'public.reel_comment_likes'::regclass
  ) THEN
    ALTER TABLE public.reel_comment_likes
      ADD CONSTRAINT reel_comment_likes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure comment_id cascades (re-create if needed with CASCADE)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reel_comment_likes_comment_id_fkey'
      AND conrelid = 'public.reel_comment_likes'::regclass
  ) THEN
    ALTER TABLE public.reel_comment_likes
      DROP CONSTRAINT reel_comment_likes_comment_id_fkey;
  END IF;
  ALTER TABLE public.reel_comment_likes
    ADD CONSTRAINT reel_comment_likes_comment_id_fkey
    FOREIGN KEY (comment_id) REFERENCES public.reel_comments(id) ON DELETE CASCADE;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Uniques (keep / ensure) — one like/save/reaction/comment-like per user
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_reel_like'
      AND conrelid = 'public.reel_likes'::regclass
  ) THEN
    ALTER TABLE public.reel_likes
      ADD CONSTRAINT unique_reel_like UNIQUE (user_id, reel_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_reel_save'
      AND conrelid = 'public.reel_saves'::regclass
  ) THEN
    ALTER TABLE public.reel_saves
      ADD CONSTRAINT unique_reel_save UNIQUE (user_id, reel_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname IN ('reel_reactions_reel_id_user_id_key', 'unique_reel_reaction')
      AND conrelid = 'public.reel_reactions'::regclass
  ) THEN
    -- already present
    NULL;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reel_reactions'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%reel_id%'
      AND pg_get_constraintdef(oid) ILIKE '%user_id%'
  ) THEN
    ALTER TABLE public.reel_reactions
      ADD CONSTRAINT unique_reel_reaction UNIQUE (reel_id, user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_reel_comment_like'
      AND conrelid = 'public.reel_comment_likes'::regclass
  ) THEN
    ALTER TABLE public.reel_comment_likes
      ADD CONSTRAINT unique_reel_comment_like UNIQUE (user_id, comment_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Trigger cleanup — single counter path, single engagement recalc
--    Drop known legacy triggers (and any other non-internal triggers on
--    engagement tables) then install one consolidated set.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  tables text[] := ARRAY[
    'reels',
    'reel_likes',
    'reel_reactions',
    'reel_comments',
    'reel_comment_likes',
    'reel_saves',
    'reel_shares',
    'reel_views'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR r IN
      SELECT tg.tgname
      FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t
        AND NOT tg.tgisinternal
    LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, t);
    END LOOP;
  END LOOP;
END $$;

-- Drop known legacy trigger function names (keep if referenced elsewhere: cascade none)
DROP FUNCTION IF EXISTS public.update_reels_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_reel_comments_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.reel_views_increment() CASCADE;
DROP FUNCTION IF EXISTS public.reel_likes_counter() CASCADE;
DROP FUNCTION IF EXISTS public.reel_saves_counter() CASCADE;
DROP FUNCTION IF EXISTS public.reel_shares_counter() CASCADE;
DROP FUNCTION IF EXISTS public.reel_comments_counter() CASCADE;
DROP FUNCTION IF EXISTS public.reel_comment_likes_counter() CASCADE;
DROP FUNCTION IF EXISTS public.reel_engagement() CASCADE;
DROP FUNCTION IF EXISTS public.reel_engagement_shares() CASCADE;
DROP FUNCTION IF EXISTS public.reel_engagement_comments() CASCADE;
DROP FUNCTION IF EXISTS public.handle_reel_like_counter() CASCADE;
DROP FUNCTION IF EXISTS public.handle_reel_view_counter() CASCADE;
DROP FUNCTION IF EXISTS public.handle_reel_save_counter() CASCADE;
DROP FUNCTION IF EXISTS public.handle_reel_share_counter() CASCADE;
DROP FUNCTION IF EXISTS public.handle_reel_comment_counter() CASCADE;
DROP FUNCTION IF EXISTS public.handle_reel_comment_like_counter() CASCADE;

-- updated_at helpers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Engagement formula (matches observed live recalc on comments):
--   likes*1 + comments*5 + shares*2 + views*0.1
-- Saves are tracked via saves_count but not weighted into engagement_score
-- (previous share/like triggers were inconsistent; this unifies them).
CREATE OR REPLACE FUNCTION public.reels_recalc_engagement(p_reel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('reels.counter_sync', 'on', true);
  UPDATE public.reels r
  SET engagement_score =
        COALESCE(r.likes_count, 0) * 1.0
      + COALESCE(r.comments_count, 0) * 5.0
      + COALESCE(r.shares_count, 0) * 2.0
      + COALESCE(r.views_count, 0) * 0.1,
      updated_at = now()
  WHERE r.id = p_reel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reels_protect_derived_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('reels.counter_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  -- Clients / authors may edit content fields, not counters or engagement.
  NEW.likes_count := OLD.likes_count;
  NEW.comments_count := OLD.comments_count;
  NEW.shares_count := OLD.shares_count;
  NEW.views_count := OLD.views_count;
  NEW.saves_count := OLD.saves_count;
  NEW.engagement_score := OLD.engagement_score;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reel_comments_protect_derived_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('reels.counter_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.likes_count := OLD.likes_count;
  NEW.replies_count := OLD.replies_count;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reel_likes_sync_counter()
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
    UPDATE public.reels SET likes_count = GREATEST(COALESCE(likes_count, 0) + 1, 0) WHERE id = rid;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = rid;
  END IF;
  PERFORM public.reels_recalc_engagement(rid);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.reel_saves_sync_counter()
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
    UPDATE public.reels SET saves_count = GREATEST(COALESCE(saves_count, 0) + 1, 0) WHERE id = rid;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET saves_count = GREATEST(COALESCE(saves_count, 0) - 1, 0) WHERE id = rid;
  END IF;
  -- saves_count is retained for feeds; engagement formula does not weight saves
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.reel_shares_sync_counter()
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
  -- Shares are append-only analytics; only INSERT increments (no UPDATE bump).
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels SET shares_count = GREATEST(COALESCE(shares_count, 0) + 1, 0) WHERE id = rid;
    PERFORM public.reels_recalc_engagement(rid);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels SET shares_count = GREATEST(COALESCE(shares_count, 0) - 1, 0) WHERE id = rid;
    PERFORM public.reels_recalc_engagement(rid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.reel_views_sync_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Views are insert-only analytics; never increment on UPDATE of view metadata.
  IF TG_OP = 'INSERT' THEN
    PERFORM set_config('reels.counter_sync', 'on', true);
    UPDATE public.reels
    SET views_count = GREATEST(COALESCE(views_count, 0) + 1, 0)
    WHERE id = NEW.reel_id;
    PERFORM public.reels_recalc_engagement(NEW.reel_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reel_comments_sync_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
  parent uuid;
BEGIN
  PERFORM set_config('reels.counter_sync', 'on', true);
  rid := COALESCE(NEW.reel_id, OLD.reel_id);

  IF TG_OP = 'INSERT' THEN
    UPDATE public.reels
    SET comments_count = GREATEST(COALESCE(comments_count, 0) + 1, 0)
    WHERE id = rid;
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE public.reel_comments
      SET replies_count = GREATEST(COALESCE(replies_count, 0) + 1, 0)
      WHERE id = NEW.parent_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reels
    SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
    WHERE id = rid;
    parent := OLD.parent_id;
    IF parent IS NOT NULL THEN
      UPDATE public.reel_comments
      SET replies_count = GREATEST(COALESCE(replies_count, 0) - 1, 0)
      WHERE id = parent;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Soft-delete toggle: is_deleted false→true decrements public count once.
    IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted THEN
      IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
        UPDATE public.reels
        SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
        WHERE id = rid;
        IF NEW.parent_id IS NOT NULL THEN
          UPDATE public.reel_comments
          SET replies_count = GREATEST(COALESCE(replies_count, 0) - 1, 0)
          WHERE id = NEW.parent_id;
        END IF;
      ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
        UPDATE public.reels
        SET comments_count = GREATEST(COALESCE(comments_count, 0) + 1, 0)
        WHERE id = rid;
        IF NEW.parent_id IS NOT NULL THEN
          UPDATE public.reel_comments
          SET replies_count = GREATEST(COALESCE(replies_count, 0) + 1, 0)
          WHERE id = NEW.parent_id;
        END IF;
      END IF;
    END IF;
    -- Do not bump counters on ordinary content edits.
  END IF;

  PERFORM public.reels_recalc_engagement(rid);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.reel_comment_likes_sync_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
BEGIN
  PERFORM set_config('reels.counter_sync', 'on', true);
  cid := COALESCE(NEW.comment_id, OLD.comment_id);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reel_comments
    SET likes_count = GREATEST(COALESCE(likes_count, 0) + 1, 0)
    WHERE id = cid;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reel_comments
    SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
    WHERE id = cid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers
CREATE TRIGGER update_reels_updated_at
  BEFORE UPDATE ON public.reels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER reels_protect_derived_columns_trigger
  BEFORE UPDATE ON public.reels
  FOR EACH ROW EXECUTE FUNCTION public.reels_protect_derived_columns();

CREATE TRIGGER update_reel_comments_updated_at
  BEFORE UPDATE ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER reel_comments_protect_derived_columns_trigger
  BEFORE UPDATE ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.reel_comments_protect_derived_columns();

CREATE TRIGGER reel_likes_counter_trigger
  AFTER INSERT OR DELETE ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.reel_likes_sync_counter();

CREATE TRIGGER reel_saves_counter_trigger
  AFTER INSERT OR DELETE ON public.reel_saves
  FOR EACH ROW EXECUTE FUNCTION public.reel_saves_sync_counter();

CREATE TRIGGER reel_shares_counter_trigger
  AFTER INSERT OR DELETE ON public.reel_shares
  FOR EACH ROW EXECUTE FUNCTION public.reel_shares_sync_counter();

CREATE TRIGGER reel_views_increment_trigger
  AFTER INSERT ON public.reel_views
  FOR EACH ROW EXECUTE FUNCTION public.reel_views_sync_counter();

CREATE TRIGGER reel_comments_counter_trigger
  AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON public.reel_comments
  FOR EACH ROW EXECUTE FUNCTION public.reel_comments_sync_counter();

CREATE TRIGGER reel_comment_likes_counter_trigger
  AFTER INSERT OR DELETE ON public.reel_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.reel_comment_likes_sync_counter();

-- ---------------------------------------------------------------------------
-- 6) Feed / engagement indexes (partial where useful)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS reels_public_feed_created_idx
  ON public.reels (created_at DESC)
  WHERE is_public = true AND is_deleted = false;

CREATE INDEX IF NOT EXISTS reels_author_created_idx
  ON public.reels (author_id, created_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS reels_category_created_idx
  ON public.reels (category, created_at DESC)
  WHERE is_public = true AND is_deleted = false;

CREATE INDEX IF NOT EXISTS reels_engagement_created_idx
  ON public.reels (engagement_score DESC, created_at DESC)
  WHERE is_public = true AND is_deleted = false;

CREATE INDEX IF NOT EXISTS reels_featured_created_idx
  ON public.reels (created_at DESC)
  WHERE is_featured = true AND is_public = true AND is_deleted = false;

CREATE INDEX IF NOT EXISTS reel_likes_user_created_idx
  ON public.reel_likes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reel_likes_reel_created_idx
  ON public.reel_likes (reel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reel_saves_user_created_idx
  ON public.reel_saves (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reel_saves_reel_created_idx
  ON public.reel_saves (reel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reel_shares_user_created_idx
  ON public.reel_shares (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reel_shares_reel_created_idx
  ON public.reel_shares (reel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reel_views_reel_created_idx
  ON public.reel_views (reel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reel_views_user_created_idx
  ON public.reel_views (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reel_comments_reel_created_idx
  ON public.reel_comments (reel_id, created_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS reel_comments_parent_created_idx
  ON public.reel_comments (parent_id, created_at DESC)
  WHERE parent_id IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS reel_reactions_reel_created_idx
  ON public.reel_reactions (reel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reel_comment_likes_comment_idx
  ON public.reel_comment_likes (comment_id, created_at DESC);

-- Drop helper after use
DROP FUNCTION IF EXISTS public._reels_drop_check_constraints(regclass);

-- ---------------------------------------------------------------------------
-- 7) RLS — own-row interactions; creators manage own reels; counters protected
--    (API service_role bypasses RLS; this hardens direct client access.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_views ENABLE ROW LEVEL SECURITY;

-- Drop prior policies on these tables so we can redefine cleanly
DO $$
DECLARE
  r record;
  tables text[] := ARRAY[
    'reels','reel_likes','reel_reactions','reel_comments',
    'reel_comment_likes','reel_saves','reel_shares','reel_views'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- reels
CREATE POLICY reels_select_public_or_own ON public.reels
  FOR SELECT USING (
    (is_public = true AND is_deleted = false)
    OR author_id = auth.uid()
  );

CREATE POLICY reels_insert_own ON public.reels
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY reels_update_own ON public.reels
  FOR UPDATE USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY reels_delete_own ON public.reels
  FOR DELETE USING (author_id = auth.uid());

-- likes
CREATE POLICY reel_likes_select_authenticated ON public.reel_likes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY reel_likes_insert_own ON public.reel_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY reel_likes_delete_own ON public.reel_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- reactions
CREATE POLICY reel_reactions_select_authenticated ON public.reel_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY reel_reactions_insert_own ON public.reel_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY reel_reactions_update_own ON public.reel_reactions
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY reel_reactions_delete_own ON public.reel_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- comments
CREATE POLICY reel_comments_select_visible ON public.reel_comments
  FOR SELECT USING (is_deleted = false OR user_id = auth.uid());

CREATE POLICY reel_comments_insert_own ON public.reel_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY reel_comments_update_own ON public.reel_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY reel_comments_delete_own ON public.reel_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- comment likes
CREATE POLICY reel_comment_likes_select_authenticated ON public.reel_comment_likes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY reel_comment_likes_insert_own ON public.reel_comment_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY reel_comment_likes_delete_own ON public.reel_comment_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- saves
CREATE POLICY reel_saves_select_own ON public.reel_saves
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY reel_saves_insert_own ON public.reel_saves
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY reel_saves_delete_own ON public.reel_saves
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- shares
CREATE POLICY reel_shares_select_own ON public.reel_shares
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY reel_shares_insert_own ON public.reel_shares
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- views (users can insert their own / anonymous via service role)
CREATE POLICY reel_views_select_own ON public.reel_views
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY reel_views_insert_own ON public.reel_views
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ---------------------------------------------------------------------------
-- 8) Optional analytics cleanup note:
--    ip_address / user_agent on reel_views are unused by the app (always null
--    in API inserts). Columns retained for now; safe to DROP in a follow-up
--    after confirming no external analytics consumer.
-- ---------------------------------------------------------------------------

-- Recalculate engagement for existing rows so feeds stay consistent
DO $$
BEGIN
  PERFORM set_config('reels.counter_sync', 'on', true);
  UPDATE public.reels r
  SET engagement_score =
        COALESCE(r.likes_count, 0) * 1.0
      + COALESCE(r.comments_count, 0) * 5.0
      + COALESCE(r.shares_count, 0) * 2.0
      + COALESCE(r.views_count, 0) * 0.1;
END $$;
