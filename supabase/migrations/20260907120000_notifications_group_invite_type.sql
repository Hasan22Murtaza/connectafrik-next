-- Allow group invite notifications on public.notifications.type.
-- Recreates the check with canonical types plus legacy values that may already exist in rows.

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
      'birthday'
    )
  );
