-- Group roles: manager + co-admin, plus content moderation and complaints.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.group_memberships'::regclass
      AND con.contype = 'c'
      AND att.attname = 'role'
  LOOP
    EXECUTE format('ALTER TABLE public.group_memberships DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

UPDATE public.group_memberships
SET role = 'member'
WHERE role = 'moderator';

ALTER TABLE public.group_memberships
  ADD CONSTRAINT group_memberships_role_check
  CHECK (role IN ('admin', 'co_admin', 'manager', 'member'));

ALTER TABLE public.group_memberships
  ADD COLUMN IF NOT EXISTS posting_restricted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS require_post_approval BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.group_posts
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE public.group_posts
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.group_posts
  ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.group_posts
  DROP CONSTRAINT IF EXISTS group_posts_moderation_status_check;

ALTER TABLE public.group_posts
  ADD CONSTRAINT group_posts_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_group_posts_group_moderation
  ON public.group_posts (group_id, moderation_status, is_hidden, created_at DESC)
  WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.group_post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  group_post_id UUID NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'sexual_content',
    'violent_or_repulsive',
    'hateful_or_abusive',
    'harmful_or_dangerous',
    'spam_or_misleading',
    'child_abuse'
  )),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'reviewed',
    'dismissed'
  )),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS group_post_reports_unique_user_reason
  ON public.group_post_reports (group_post_id, reported_by, reason)
  WHERE reported_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_group_post_reports_group_status
  ON public.group_post_reports (group_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_post_reports_post
  ON public.group_post_reports (group_post_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_group_post_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_post_reports_updated_at ON public.group_post_reports;
CREATE TRIGGER trg_group_post_reports_updated_at
  BEFORE UPDATE ON public.group_post_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_group_post_reports_updated_at();

ALTER TABLE public.group_post_reports ENABLE ROW LEVEL SECURITY;
