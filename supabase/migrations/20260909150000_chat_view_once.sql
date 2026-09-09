-- View Once media messages (photos/videos). Flags live on the message row, not the thread.
-- Enforcement is server-side (service role APIs + this trigger). Clients cannot flip opened state.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS view_once boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_once_opened boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_once_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS view_once_opened_by uuid;

CREATE INDEX IF NOT EXISTS idx_chat_messages_view_once_unopened
  ON public.chat_messages (thread_id, created_at DESC)
  WHERE view_once = true AND view_once_opened = false;

COMMENT ON COLUMN public.chat_messages.view_once IS
  'When true, photo/video attachments are one-time view; URLs must not be returned by list APIs.';
COMMENT ON COLUMN public.chat_messages.view_once_opened IS
  'Set atomically on the first valid viewing claim. Clients must not write this column.';

-- Block non-service clients from changing View Once columns (e.g. message edit via user JWT).
CREATE OR REPLACE FUNCTION public.protect_chat_view_once_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('role', true) IN ('service_role', 'supabase_admin', 'postgres') THEN
    RETURN NEW;
  END IF;
  NEW.view_once := OLD.view_once;
  NEW.view_once_opened := OLD.view_once_opened;
  NEW.view_once_opened_at := OLD.view_once_opened_at;
  NEW.view_once_opened_by := OLD.view_once_opened_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_chat_view_once_columns ON public.chat_messages;
CREATE TRIGGER trg_protect_chat_view_once_columns
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_chat_view_once_columns();

-- Atomic first-open: only one claim wins across tabs/devices.
CREATE OR REPLACE FUNCTION public.claim_chat_view_once(
  p_message_id uuid,
  p_user_id uuid
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.chat_messages;
BEGIN
  UPDATE public.chat_messages
  SET
    view_once_opened = true,
    view_once_opened_at = now(),
    view_once_opened_by = p_user_id,
    updated_at = now()
  WHERE id = p_message_id
    AND view_once = true
    AND view_once_opened = false
    AND is_deleted = false
    AND sender_id IS DISTINCT FROM p_user_id
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_chat_view_once(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chat_view_once(uuid, uuid) TO service_role;
