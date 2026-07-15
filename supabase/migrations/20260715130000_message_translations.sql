ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS message_translation_language text
    NOT NULL DEFAULT 'off'
    CHECK (
      message_translation_language IN ('off', 'en', 'fr', 'es', 'pt', 'de', 'ar', 'sw')
    );

CREATE TABLE IF NOT EXISTS public.chat_message_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages (id) ON DELETE CASCADE,
  target_language text NOT NULL CHECK (
    target_language IN ('en', 'fr', 'es', 'pt', 'de', 'ar', 'sw')
  ),
  translated_text text NOT NULL,
  source_language text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, target_language)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_translations_message
  ON public.chat_message_translations (message_id);

ALTER TABLE public.chat_message_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_message_translations_select_authenticated"
  ON public.chat_message_translations
  FOR SELECT
  TO authenticated
  USING (true);
