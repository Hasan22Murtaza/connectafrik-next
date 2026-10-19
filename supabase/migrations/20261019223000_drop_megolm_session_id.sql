-- Signal E2EE no longer uses megolm_session_id.
-- Whisper/PreKey type lives on signal_message_envelopes.message_type.

alter table public.chat_messages
  drop column if exists megolm_session_id;
