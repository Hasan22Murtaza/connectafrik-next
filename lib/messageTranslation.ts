import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MESSAGE_TRANSLATION_TARGET_LANGUAGES,
  type MessageTranslationTargetCode,
} from '@/features/chat/constants/messageTranslationLanguages'
import { deepseekChatCompletion } from '@/lib/deepseek'

const MAX_TRANSLATION_CHARS = 8000

export type CachedMessageTranslation = {
  message_id: string
  target_language: MessageTranslationTargetCode
  translated_text: string
  source_language: string | null
}

function targetLanguageLabel(code: MessageTranslationTargetCode): string {
  return MESSAGE_TRANSLATION_TARGET_LANGUAGES.find((l) => l.code === code)?.label ?? code
}

export function isTranslatableMessageContent(content: string | null | undefined): boolean {
  const trimmed = (content ?? '').trim()
  return trimmed.length > 0 && trimmed.length <= MAX_TRANSLATION_CHARS
}

export async function fetchCachedTranslations(
  serviceClient: SupabaseClient,
  messageIds: string[],
  targetLanguage: MessageTranslationTargetCode
): Promise<Map<string, CachedMessageTranslation>> {
  const uniqueIds = [...new Set(messageIds.filter(Boolean))]
  const result = new Map<string, CachedMessageTranslation>()
  if (uniqueIds.length === 0) return result

  const { data, error } = await serviceClient
    .from('chat_message_translations')
    .select('message_id, target_language, translated_text, source_language')
    .in('message_id', uniqueIds)
    .eq('target_language', targetLanguage)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    result.set(row.message_id, row as CachedMessageTranslation)
  }
  return result
}

export async function saveCachedTranslation(
  serviceClient: SupabaseClient,
  messageId: string,
  targetLanguage: MessageTranslationTargetCode,
  translatedText: string,
  sourceLanguage?: string | null
): Promise<CachedMessageTranslation> {
  const { data, error } = await serviceClient
    .from('chat_message_translations')
    .upsert(
      {
        message_id: messageId,
        target_language: targetLanguage,
        translated_text: translatedText,
        source_language: sourceLanguage ?? null,
      },
      { onConflict: 'message_id,target_language' }
    )
    .select('message_id, target_language, translated_text, source_language')
    .single()

  if (error) throw new Error(error.message)
  return data as CachedMessageTranslation
}

export async function translateTextWithDeepSeek(
  text: string,
  targetLanguage: MessageTranslationTargetCode
): Promise<string> {
  const languageName = targetLanguageLabel(targetLanguage)
  const { content } = await deepseekChatCompletion(
    [
      {
        role: 'system',
        content:
          `Translate the user's message into ${languageName}. ` +
          'Return only the translated text with no quotes, labels, or explanations. ' +
          'Preserve line breaks and light formatting (markdown/links) when present.',
      },
      { role: 'user', content: text },
    ],
    { temperature: 0.2, maxTokens: 2048 }
  )
  return content
}

export async function getOrCreateMessageTranslation(
  serviceClient: SupabaseClient,
  messageId: string,
  originalText: string,
  targetLanguage: MessageTranslationTargetCode
): Promise<CachedMessageTranslation> {
  const cached = await fetchCachedTranslations(serviceClient, [messageId], targetLanguage)
  const existing = cached.get(messageId)
  if (existing) return existing

  const translatedText = await translateTextWithDeepSeek(originalText, targetLanguage)
  return saveCachedTranslation(serviceClient, messageId, targetLanguage, translatedText)
}
