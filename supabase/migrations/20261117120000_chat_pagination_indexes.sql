-- Chat pagination / inbox query indexes.
-- Supports cursor history (thread_id + created_at + id) and participant inbox lookups.

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created_id
  ON public.chat_messages (thread_id, created_at DESC, id DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_chat_participants_user_active
  ON public.chat_participants (user_id, thread_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_threads_last_message_at
  ON public.chat_threads (last_message_at DESC NULLS LAST);
