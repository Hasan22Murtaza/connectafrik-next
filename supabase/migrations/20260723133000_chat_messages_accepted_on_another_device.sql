-- Allow persisted chat history row when a callee answers on another device.

alter table public.chat_messages drop constraint if exists chat_messages_message_type_check;

alter table public.chat_messages
  add constraint chat_messages_message_type_check check (
    message_type in (
      'text',
      'image',
      'video',
      'audio',
      'file',
      'post-share',
      'call_notification',
      'hand_raised',
      'reaction',
      'screen_share_started',
      'screen_share_stopped',
      'group_member_joined',
      'group_member_left',
      'initiated',
      'ringing',
      'active',
      'declined',
      'ended',
      'missed',
      'failed',
      'accepted_on_another_device',
      'marketplace_inquiry',
      'marketplace_system'
    )
  )
  not valid;
