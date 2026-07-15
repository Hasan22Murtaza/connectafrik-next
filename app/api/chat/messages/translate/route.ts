import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'
import {
  isMessageTranslationLanguageCode,
  type MessageTranslationTargetCode,
} from '@/features/chat/constants/messageTranslationLanguages'
import {
  fetchCachedTranslations,
  getOrCreateMessageTranslation,
  isTranslatableMessageContent,
} from '@/lib/messageTranslation'
import { DeepSeekError } from '@/lib/deepseek'

type TranslateBody = {
  threadId?: string
  messageId?: string
  messageIds?: string[]
  targetLanguage?: string
}

function isTargetLanguage(value: string): value is MessageTranslationTargetCode {
  return isMessageTranslationLanguageCode(value) && value !== 'off'
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = (await request.json()) as TranslateBody

    const targetLanguage = body.targetLanguage?.trim()
    const threadId = body.threadId?.trim()
    const messageIds = [
      ...(body.messageIds ?? []),
      ...(body.messageId ? [body.messageId] : []),
    ]
      .map((id) => id?.trim())
      .filter((id): id is string => Boolean(id))

    if (!targetLanguage || !isTargetLanguage(targetLanguage)) {
      return errorResponse('Invalid target language', 400)
    }
    if (!threadId) {
      return errorResponse('threadId is required', 400)
    }
    if (messageIds.length === 0) {
      return errorResponse('At least one messageId is required', 400)
    }
    if (messageIds.length > 50) {
      return errorResponse('Too many messages in one request (max 50)', 400)
    }

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: messages, error: messagesError } = await serviceClient
      .from('chat_messages')
      .select('id, content, thread_id, is_deleted, message_type')
      .in('id', messageIds)
      .eq('thread_id', threadId)

    if (messagesError) {
      return errorResponse(messagesError.message, 400)
    }

    const messageById = new Map((messages ?? []).map((m) => [m.id, m]))
    const translations: Record<
      string,
      { translatedText: string; cached: boolean; sourceLanguage?: string | null }
    > = {}
    const errors: Record<string, string> = {}

    const cached = await fetchCachedTranslations(serviceClient, messageIds, targetLanguage)

    for (const messageId of messageIds) {
      const message = messageById.get(messageId)
      if (!message) {
        errors[messageId] = 'Message not found'
        continue
      }
      if (message.is_deleted) {
        errors[messageId] = 'Message was deleted'
        continue
      }
      if ((message.message_type || 'text') !== 'text') {
        errors[messageId] = 'Only text messages can be translated'
        continue
      }
      if (!isTranslatableMessageContent(message.content)) {
        errors[messageId] = 'Message has no translatable text'
        continue
      }

      const hit = cached.get(messageId)
      if (hit) {
        translations[messageId] = {
          translatedText: hit.translated_text,
          cached: true,
          sourceLanguage: hit.source_language,
        }
        continue
      }

      try {
        const created = await getOrCreateMessageTranslation(
          serviceClient,
          messageId,
          message.content!.trim(),
          targetLanguage
        )
        translations[messageId] = {
          translatedText: created.translated_text,
          cached: false,
          sourceLanguage: created.source_language,
        }
      } catch (err: unknown) {
        errors[messageId] =
          err instanceof Error ? err.message : 'Translation failed'
      }
    }

    return jsonResponse({
      targetLanguage,
      translations,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message === 'Unauthorized' || error.message === 'Missing Authorization header')
    ) {
      return unauthorizedResponse()
    }
    if (error instanceof DeepSeekError) {
      return errorResponse(error.message, 502)
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
