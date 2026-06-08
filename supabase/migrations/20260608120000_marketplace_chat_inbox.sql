-- Marketplace inbox: product-scoped chat threads + message types on chat_messages.

alter table public.chat_threads
  add column if not exists product_id uuid references public.products (id) on delete set null;

alter table public.chat_threads
  add column if not exists seller_id uuid references public.profiles (id) on delete set null;

-- Allow `type = 'marketplace'` on chat_threads (NOT VALID skips full-table scan on deploy).
alter table public.chat_threads drop constraint if exists chat_threads_type_check;

alter table public.chat_threads
  add constraint chat_threads_type_check check (
    type in ('direct', 'group', 'marketplace')
  )
  not valid;

create index if not exists idx_chat_threads_product_id
  on public.chat_threads using btree (product_id)
  where
    product_id is not null;

create index if not exists idx_chat_threads_marketplace
  on public.chat_threads using btree (type, product_id, last_message_at desc)
  where
    type = 'marketplace';

-- Extend message_type check (NOT VALID avoids full-table scan on deploy).
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
      'marketplace_inquiry',
      'marketplace_system'
    )
  )
  not valid;
