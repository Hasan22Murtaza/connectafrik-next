-- Align privacy enforcement with the existing public.profiles schema.
-- All privacy columns from current profiles already exist except show_read_receipts.
-- Existing accounts inherit the same safe defaults used by the privacy settings UI.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_read_receipts boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.show_read_receipts IS
  'When false, other users cannot see that this user has read their messages.';

UPDATE public.profiles SET profile_visibility = 'public' WHERE profile_visibility IS NULL;
UPDATE public.profiles SET post_visibility = 'public' WHERE post_visibility IS NULL;
UPDATE public.profiles SET allow_comments = 'everyone' WHERE allow_comments IS NULL;
UPDATE public.profiles SET allow_follows = 'everyone' WHERE allow_follows IS NULL;
UPDATE public.profiles SET allow_direct_messages = 'everyone' WHERE allow_direct_messages IS NULL;
UPDATE public.profiles SET show_online_status = true WHERE show_online_status IS NULL;
UPDATE public.profiles SET show_last_seen = true WHERE show_last_seen IS NULL;
UPDATE public.profiles SET show_location = true WHERE show_location IS NULL;
UPDATE public.profiles SET show_phone = false WHERE show_phone IS NULL;
UPDATE public.profiles SET show_email = false WHERE show_email IS NULL;
UPDATE public.profiles SET show_followers = true WHERE show_followers IS NULL;
UPDATE public.profiles SET show_following = true WHERE show_following IS NULL;
UPDATE public.profiles SET show_country = true WHERE show_country IS NULL;
UPDATE public.profiles SET show_followers_count = true WHERE show_followers_count IS NULL;
UPDATE public.profiles SET is_record = true WHERE is_record IS NULL;
UPDATE public.profiles SET is_capture = true WHERE is_capture IS NULL;

ALTER TABLE public.profiles ALTER COLUMN profile_visibility SET DEFAULT 'public';
ALTER TABLE public.profiles ALTER COLUMN post_visibility SET DEFAULT 'public';
ALTER TABLE public.profiles ALTER COLUMN allow_comments SET DEFAULT 'everyone';
ALTER TABLE public.profiles ALTER COLUMN allow_follows SET DEFAULT 'everyone';
ALTER TABLE public.profiles ALTER COLUMN allow_direct_messages SET DEFAULT 'everyone';
ALTER TABLE public.profiles ALTER COLUMN show_online_status SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN show_last_seen SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN show_location SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN show_phone SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN show_email SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN show_followers SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN show_following SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN show_country SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN show_followers_count SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN is_record SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN is_capture SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.privacy_are_friends(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND (
    a = b
    OR EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.sender_id = a AND fr.receiver_id = b)
          OR (fr.sender_id = b AND fr.receiver_id = a)
        )
    )
    OR (
      EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = a AND f.following_id = b)
      AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = b AND f.following_id = a)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.privacy_is_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND a <> b AND (
    EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE fr.status = 'blocked'
        AND (
          (fr.sender_id = a AND fr.receiver_id = b)
          OR (fr.sender_id = b AND fr.receiver_id = a)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      JOIN public.chat_threads t ON t.id = cp.thread_id
      JOIN public.chat_participants other
        ON other.thread_id = cp.thread_id
       AND other.user_id = CASE WHEN cp.user_id = a THEN b ELSE a END
      WHERE t.type = 'direct'
        AND cp.is_block = true
        AND cp.user_id IN (a, b)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.privacy_can_view_profile(viewer uuid, owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN owner IS NULL THEN false
    WHEN viewer = owner THEN true
    WHEN public.privacy_is_blocked(viewer, owner) THEN false
    ELSE CASE COALESCE((SELECT p.profile_visibility FROM public.profiles p WHERE p.id = owner), 'public')
      WHEN 'public' THEN true
      WHEN 'everyone' THEN true
      WHEN 'private' THEN false
      WHEN 'friends' THEN viewer IS NOT NULL AND public.privacy_are_friends(viewer, owner)
      ELSE false
    END
  END;
$$;

CREATE OR REPLACE FUNCTION public.privacy_can_view_post(viewer uuid, post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_id
      AND COALESCE(p.is_deleted, false) = false
      AND (
        p.author_id = viewer
        OR (
          NOT public.privacy_is_blocked(viewer, p.author_id)
          AND CASE COALESCE((SELECT pr.post_visibility FROM public.profiles pr WHERE pr.id = p.author_id), 'public')
            WHEN 'public' THEN true
            WHEN 'everyone' THEN true
            WHEN 'private' THEN false
            WHEN 'friends' THEN viewer IS NOT NULL AND public.privacy_are_friends(viewer, p.author_id)
            ELSE false
          END
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.privacy_are_friends(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.privacy_is_blocked(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.privacy_can_view_profile(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.privacy_can_view_post(uuid, uuid) TO anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'posts'
  ) THEN
    ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS posts_privacy_select_restrictive ON public.posts;
    CREATE POLICY posts_privacy_select_restrictive ON public.posts
      AS RESTRICTIVE
      FOR SELECT
      TO anon, authenticated
      USING (public.privacy_can_view_post(auth.uid(), id));
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'comments'
  ) THEN
    ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS comments_privacy_select_restrictive ON public.comments;
    CREATE POLICY comments_privacy_select_restrictive ON public.comments
      AS RESTRICTIVE
      FOR SELECT
      TO anon, authenticated
      USING (public.privacy_can_view_post(auth.uid(), post_id));
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'message_reads'
  ) THEN
    ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS message_reads_privacy_select_restrictive ON public.message_reads;
    CREATE POLICY message_reads_privacy_select_restrictive ON public.message_reads
      AS RESTRICTIVE
      FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR (
          NOT public.privacy_is_blocked(auth.uid(), user_id)
          AND COALESCE((SELECT pr.show_read_receipts FROM public.profiles pr WHERE pr.id = user_id), true)
        )
      );
  END IF;
END
$$;
