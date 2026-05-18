-- Per-user block flag on chat_participants (WhatsApp-style: only affects the blocking user's row).

alter table public.chat_participants
  add column if not exists is_block boolean not null default false;

comment on column public.chat_participants.is_block is
  'When true, this participant has blocked the other party in this thread.';
