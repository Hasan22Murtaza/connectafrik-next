-- Family & Parental Controls (additive, backward compatible).
-- Does NOT modify existing profile/auth/chat/friend columns or backfill users.
-- Existing users with no family membership keep current CribsTalk behavior.

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger (shared name pattern)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_families_created_by ON public.families (created_by);
CREATE INDEX IF NOT EXISTS idx_families_status ON public.families (status);

DROP TRIGGER IF EXISTS trg_families_updated_at ON public.families;
CREATE TRIGGER trg_families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- family_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('parent', 'child', 'teen')),
  relationship TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
  joined_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT family_members_family_user_unique UNIQUE (family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members (user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_status ON public.family_members (family_id, status);
CREATE INDEX IF NOT EXISTS idx_family_members_user_status ON public.family_members (user_id, status);

-- One active family membership per user (pending invites may exist as invitations, not members).
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_one_active_per_user
  ON public.family_members (user_id)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_family_members_updated_at ON public.family_members;
CREATE TRIGGER trg_family_members_updated_at
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- family_invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  invitee_email TEXT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'child', 'teen')),
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')
  ),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT family_invitations_invitee_present CHECK (
    invitee_user_id IS NOT NULL OR invitee_email IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_family_invitations_family_id ON public.family_invitations (family_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_invitee_user ON public.family_invitations (invitee_user_id)
  WHERE invitee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_family_invitations_invitee_email ON public.family_invitations (lower(invitee_email))
  WHERE invitee_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_invitations_token_hash ON public.family_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_family_invitations_pending ON public.family_invitations (status, expires_at)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- parental_controls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parental_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID NOT NULL UNIQUE REFERENCES public.family_members(id) ON DELETE CASCADE,
  friend_request_approval BOOLEAN NOT NULL DEFAULT false,
  messaging_enabled BOOLEAN NOT NULL DEFAULT true,
  calling_enabled BOOLEAN NOT NULL DEFAULT true,
  group_joining_enabled BOOLEAN NOT NULL DEFAULT true,
  marketplace_enabled BOOLEAN NOT NULL DEFAULT true,
  screen_time_enabled BOOLEAN NOT NULL DEFAULT false,
  content_filter_level TEXT NULL CHECK (
    content_filter_level IS NULL OR content_filter_level IN ('off', 'low', 'medium', 'high')
  ),
  profile_visibility TEXT NULL,
  location_sharing BOOLEAN NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_parental_controls_updated_at ON public.parental_controls;
CREATE TRIGGER trg_parental_controls_updated_at
  BEFORE UPDATE ON public.parental_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- screen_time_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.screen_time_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID NOT NULL UNIQUE REFERENCES public.family_members(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  daily_limit_minutes INTEGER NULL CHECK (
    daily_limit_minutes IS NULL OR (daily_limit_minutes >= 0 AND daily_limit_minutes <= 1440)
  ),
  allowed_start_time TIME NULL,
  allowed_end_time TIME NULL,
  bedtime_start TIME NULL,
  bedtime_end TIME NULL,
  -- Optional per-weekday overrides: { "mon": { "daily_limit_minutes": 60, ... }, ... }
  per_day_config JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_screen_time_rules_updated_at ON public.screen_time_rules;
CREATE TRIGGER trg_screen_time_rules_updated_at
  BEFORE UPDATE ON public.screen_time_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- activity_events (aggregate signals only — never message content / E2EE keys)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'session_ping',
    'post_view',
    'reel_view',
    'message_sent',
    'call',
    'friend_request_sent',
    'friend_request_received',
    'friend_added',
    'group_joined',
    'report',
    'safety_alert',
    'marketplace_view'
  )),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  metadata JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_member_occurred
  ON public.activity_events (family_member_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_occurred
  ON public.activity_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_type_occurred
  ON public.activity_events (event_type, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- safety_alerts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.safety_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'suspicious_contact',
    'reported_content',
    'bullying',
    'harassment',
    'sexual_content',
    'self_harm_risk',
    'dangerous_content',
    'multiple_reports',
    'account_compromise'
  )),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NULL,
  source TEXT NULL,
  related_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_content_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_safety_alerts_member_created
  ON public.safety_alerts (family_member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_status
  ON public.safety_alerts (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (avoid recursive RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.family_is_active_member(p_family_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm
    JOIN public.families f ON f.id = fm.family_id
    WHERE fm.family_id = p_family_id
      AND fm.user_id = p_user_id
      AND fm.status = 'active'
      AND f.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.family_is_active_parent(p_family_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm
    JOIN public.families f ON f.id = fm.family_id
    WHERE fm.family_id = p_family_id
      AND fm.user_id = p_user_id
      AND fm.role = 'parent'
      AND fm.status = 'active'
      AND f.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.family_member_family_id(p_member_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fm.family_id FROM public.family_members fm WHERE fm.id = p_member_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.family_user_active_member_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fm.id
  FROM public.family_members fm
  JOIN public.families f ON f.id = fm.family_id
  WHERE fm.user_id = p_user_id
    AND fm.status = 'active'
    AND f.status = 'active'
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parental_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_time_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_alerts ENABLE ROW LEVEL SECURITY;

-- families
DROP POLICY IF EXISTS families_select_member ON public.families;
CREATE POLICY families_select_member ON public.families
  FOR SELECT TO authenticated
  USING (public.family_is_active_member(id, auth.uid()));

DROP POLICY IF EXISTS families_insert_creator ON public.families;
CREATE POLICY families_insert_creator ON public.families
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS families_update_parent ON public.families;
CREATE POLICY families_update_parent ON public.families
  FOR UPDATE TO authenticated
  USING (public.family_is_active_parent(id, auth.uid()))
  WITH CHECK (public.family_is_active_parent(id, auth.uid()));

-- family_members
DROP POLICY IF EXISTS family_members_select_same_family ON public.family_members;
CREATE POLICY family_members_select_same_family ON public.family_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.family_is_active_member(family_id, auth.uid())
  );

DROP POLICY IF EXISTS family_members_insert_parent ON public.family_members;
CREATE POLICY family_members_insert_parent ON public.family_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.family_is_active_parent(family_id, auth.uid())
    OR (
      -- Allow creator bootstrap: first parent row for a family they created
      user_id = auth.uid()
      AND role = 'parent'
      AND EXISTS (
        SELECT 1 FROM public.families f
        WHERE f.id = family_id AND f.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS family_members_update_parent_or_self ON public.family_members;
CREATE POLICY family_members_update_parent_or_self ON public.family_members
  FOR UPDATE TO authenticated
  USING (
    public.family_is_active_parent(family_id, auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.family_is_active_parent(family_id, auth.uid())
    OR user_id = auth.uid()
  );

-- family_invitations
DROP POLICY IF EXISTS family_invitations_select ON public.family_invitations;
CREATE POLICY family_invitations_select ON public.family_invitations
  FOR SELECT TO authenticated
  USING (
    public.family_is_active_parent(family_id, auth.uid())
    OR invitee_user_id = auth.uid()
    OR invited_by = auth.uid()
  );

DROP POLICY IF EXISTS family_invitations_insert_parent ON public.family_invitations;
CREATE POLICY family_invitations_insert_parent ON public.family_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.family_is_active_parent(family_id, auth.uid())
    AND invited_by = auth.uid()
  );

DROP POLICY IF EXISTS family_invitations_update ON public.family_invitations;
CREATE POLICY family_invitations_update ON public.family_invitations
  FOR UPDATE TO authenticated
  USING (
    public.family_is_active_parent(family_id, auth.uid())
    OR invitee_user_id = auth.uid()
  )
  WITH CHECK (
    public.family_is_active_parent(family_id, auth.uid())
    OR invitee_user_id = auth.uid()
  );

-- parental_controls
DROP POLICY IF EXISTS parental_controls_select ON public.parental_controls;
CREATE POLICY parental_controls_select ON public.parental_controls
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = family_member_id
        AND (
          fm.user_id = auth.uid()
          OR public.family_is_active_parent(fm.family_id, auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS parental_controls_insert_parent ON public.parental_controls;
CREATE POLICY parental_controls_insert_parent ON public.parental_controls
  FOR INSERT TO authenticated
  WITH CHECK (
    public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
  );

DROP POLICY IF EXISTS parental_controls_update_parent ON public.parental_controls;
CREATE POLICY parental_controls_update_parent ON public.parental_controls
  FOR UPDATE TO authenticated
  USING (
    public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
  )
  WITH CHECK (
    public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
  );

-- screen_time_rules
DROP POLICY IF EXISTS screen_time_rules_select ON public.screen_time_rules;
CREATE POLICY screen_time_rules_select ON public.screen_time_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = family_member_id
        AND (
          fm.user_id = auth.uid()
          OR public.family_is_active_parent(fm.family_id, auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS screen_time_rules_insert_parent ON public.screen_time_rules;
CREATE POLICY screen_time_rules_insert_parent ON public.screen_time_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
  );

DROP POLICY IF EXISTS screen_time_rules_update_parent ON public.screen_time_rules;
CREATE POLICY screen_time_rules_update_parent ON public.screen_time_rules
  FOR UPDATE TO authenticated
  USING (
    public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
  )
  WITH CHECK (
    public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
  );

-- activity_events
DROP POLICY IF EXISTS activity_events_select ON public.activity_events;
CREATE POLICY activity_events_select ON public.activity_events
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
  );

DROP POLICY IF EXISTS activity_events_insert_own ON public.activity_events;
CREATE POLICY activity_events_insert_own ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND family_member_id = public.family_user_active_member_id(auth.uid())
  );

-- safety_alerts
DROP POLICY IF EXISTS safety_alerts_select ON public.safety_alerts;
CREATE POLICY safety_alerts_select ON public.safety_alerts
  FOR SELECT TO authenticated
  USING (
    public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.id = family_member_id AND fm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS safety_alerts_update_parent ON public.safety_alerts;
CREATE POLICY safety_alerts_update_parent ON public.safety_alerts
  FOR UPDATE TO authenticated
  USING (
    public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
  )
  WITH CHECK (
    public.family_is_active_parent(
      public.family_member_family_id(family_member_id),
      auth.uid()
    )
  );

-- Inserts for safety alerts go through service role / server APIs.
DROP POLICY IF EXISTS safety_alerts_insert_deny ON public.safety_alerts;
CREATE POLICY safety_alerts_insert_deny ON public.safety_alerts
  FOR INSERT TO authenticated
  WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE ON public.families TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.family_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.family_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.parental_controls TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.screen_time_rules TO authenticated;
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT SELECT, UPDATE ON public.safety_alerts TO authenticated;

GRANT ALL ON public.families TO service_role;
GRANT ALL ON public.family_members TO service_role;
GRANT ALL ON public.family_invitations TO service_role;
GRANT ALL ON public.parental_controls TO service_role;
GRANT ALL ON public.screen_time_rules TO service_role;
GRANT ALL ON public.activity_events TO service_role;
GRANT ALL ON public.safety_alerts TO service_role;

-- ---------------------------------------------------------------------------
-- Extend notifications type check (additive — keeps all prior types)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'like',
      'new_order',
      'system',
      'post_like',
      'post_comment',
      'post_comment_like',
      'post_create',
      'post_share',
      'post_reaction',
      'comment',
      'comment_reply',
      'comment_like',
      'comment_reaction',
      'reel_like',
      'reel_comment',
      'reel_create',
      'reel_share',
      'reel_comment_like',
      'follow',
      'unfollow',
      'mention',
      'friend_request',
      'friend_request_accepted',
      'friend_request_confirmed',
      'friend_request_declined',
      'group_join_request',
      'group_join_approved',
      'group_join_rejected',
      'group_invite',
      'chat_message',
      'call',
      'initiated',
      'ringing',
      'active',
      'ended',
      'declined',
      'missed',
      'failed',
      'birthday',
      'family_invite',
      'family_invite_accepted',
      'family_controls_updated',
      'family_screen_time_updated',
      'family_screen_time_limit',
      'family_safety_alert',
      'family_friend_request_approved'
    )
  );
