-- Allow group membership system lines (`lib/groupChatSystemMessages.ts`).
-- NOT VALID skips a full-table scan so legacy message_type rows stay valid until you run
-- VALIDATE CONSTRAINT when ready.

alter table public.chat_messages drop constraint if exists chat_messages_message_type_check;

alter table public.chat_messages
  add constraint chat_messages_message_type_check check (
    message_type in (
      'text',
      'initiated',
      'ringing',
      'active',
      'declined',
      'ended',
      'missed',
      'failed',
      'call_notification',
      'hand_raised',
      'reaction',
      'screen_share_started',
      'screen_share_stopped',
      'group_member_joined',
      'group_member_left'
    )
  )
  not valid;
