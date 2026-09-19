-- Align notification preference columns with /profile?tab=notifications.
-- Existing accounts inherit the same defaults used by the notification settings UI.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS comment_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS like_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follow_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS message_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mention_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS post_updates boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.email_notifications IS
  'Global SES gate for notification emails. Transactional mail is unaffected.';
COMMENT ON COLUMN public.profiles.push_notifications IS
  'Global FCM/VoIP gate. In-app notifications still follow category toggles.';
COMMENT ON COLUMN public.profiles.comment_notifications IS
  'When false, do not create comment notifications for this user.';
COMMENT ON COLUMN public.profiles.like_notifications IS
  'When false, do not create like/reaction notifications for this user.';
COMMENT ON COLUMN public.profiles.follow_notifications IS
  'When false, do not notify this user about follows or friend requests.';
COMMENT ON COLUMN public.profiles.message_notifications IS
  'When false, do not send message notifications. Chat delivery is unchanged.';
COMMENT ON COLUMN public.profiles.mention_notifications IS
  'When false, do not create mention notifications for this user.';
COMMENT ON COLUMN public.profiles.post_updates IS
  'When true, notify this user about new posts/reels from people they follow.';

UPDATE public.profiles SET email_notifications = true WHERE email_notifications IS NULL;
UPDATE public.profiles SET push_notifications = true WHERE push_notifications IS NULL;
UPDATE public.profiles SET comment_notifications = true WHERE comment_notifications IS NULL;
UPDATE public.profiles SET like_notifications = true WHERE like_notifications IS NULL;
UPDATE public.profiles SET follow_notifications = true WHERE follow_notifications IS NULL;
UPDATE public.profiles SET message_notifications = true WHERE message_notifications IS NULL;
UPDATE public.profiles SET mention_notifications = true WHERE mention_notifications IS NULL;
UPDATE public.profiles SET post_updates = false WHERE post_updates IS NULL;

ALTER TABLE public.profiles ALTER COLUMN email_notifications SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN push_notifications SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN comment_notifications SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN like_notifications SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN follow_notifications SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN message_notifications SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN mention_notifications SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN post_updates SET DEFAULT false;
