'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { useProfile } from '@/shared/hooks/useProfile'
import { type ChatMessage } from '@/features/chat/services/supabaseMessagingService'
import {
  type MessageTranslationLanguageCode,
  type MessageTranslationTargetCode,
} from '@/features/chat/constants/messageTranslationLanguages'
import { toast } from 'react-hot-toast'

type TranslationEntry = {
  text: string
  language: MessageTranslationTargetCode
}

type MessageOverride = {
  language: MessageTranslationTargetCode
  showOriginal: boolean
}

type TranslateApiResponse = {
  targetLanguage: MessageTranslationTargetCode
  translations: Record<
    string,
    { translatedText: string; cached: boolean; sourceLanguage?: string | null }
  >
  errors?: Record<string, string>
}

function isTextMessage(message: ChatMessage): boolean {
  if (message.is_deleted) return false
  return (message.message_type || 'text') === 'text' && Boolean(message.content?.trim())
}

function translationKey(messageId: string, language: MessageTranslationTargetCode) {
  return `${messageId}:${language}`
}

export function useMessageTranslations(
  threadId: string,
  _messages: ChatMessage[],
  _currentUserId?: string | null
) {
  const { profile, updateProfile } = useProfile()
  const receiveLanguage: MessageTranslationLanguageCode =
    profile?.message_translation_language ?? 'off'

  const [translations, setTranslations] = useState<Record<string, TranslationEntry>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set())
  const [overrides, setOverrides] = useState<Record<string, MessageOverride>>({})
  const inFlightRef = useRef<Set<string>>(new Set())
  /** Successfully handled or failed — never auto-retry the same message+language. */
  const settledRef = useRef<Set<string>>(new Set())
  const translationsRef = useRef(translations)
  translationsRef.current = translations

  const setReceiveLanguage = useCallback(
    async (language: MessageTranslationLanguageCode) => {
      if (language === receiveLanguage) return true
      const { error } = await updateProfile({ message_translation_language: language })
      if (error) {
        toast.error('Could not save translation preference')
        return false
      }
      settledRef.current.clear()
      inFlightRef.current.clear()
      setTranslations({})
      setOverrides({})
      return true
    },
    [receiveLanguage, updateProfile]
  )

  useEffect(() => {
    settledRef.current.clear()
    inFlightRef.current.clear()
    setTranslations({})
    setOverrides({})
  }, [threadId])

  const requestTranslations = useCallback(
    async (
      messageIds: string[],
      targetLanguage: MessageTranslationTargetCode,
      options?: { force?: boolean }
    ) => {
      const pending = messageIds.filter((id) => {
        if (!id) return false
        const key = translationKey(id, targetLanguage)
        if (inFlightRef.current.has(key)) return false
        if (!options?.force && settledRef.current.has(key)) return false
        return true
      })
      if (pending.length === 0) return

      for (const id of pending) {
        inFlightRef.current.add(translationKey(id, targetLanguage))
      }
      setLoadingIds((prev) => {
        const next = new Set(prev)
        for (const id of pending) next.add(id)
        return next
      })

      try {
        const res = await apiClient.post<TranslateApiResponse>(
          '/api/chat/messages/translate',
          {
            threadId,
            messageIds: pending,
            targetLanguage,
          }
        )

        setTranslations((prev) => {
          const next = { ...prev }
          for (const [messageId, row] of Object.entries(res.translations ?? {})) {
            next[messageId] = { text: row.translatedText, language: targetLanguage }
            settledRef.current.add(translationKey(messageId, targetLanguage))
          }
          return next
        })

        // Per-message failures: settle so we do not loop forever
        for (const messageId of Object.keys(res.errors ?? {})) {
          settledRef.current.add(translationKey(messageId, targetLanguage))
        }

        // Any pending that got neither translation nor error still settle once
        for (const id of pending) {
          const key = translationKey(id, targetLanguage)
          if (!settledRef.current.has(key)) {
            settledRef.current.add(key)
          }
        }

        if (res.errors) {
          const firstError = Object.values(res.errors)[0]
          if (firstError) toast.error(firstError)
        }
      } catch (err: unknown) {
        for (const id of pending) {
          settledRef.current.add(translationKey(id, targetLanguage))
        }
        toast.error(err instanceof Error ? err.message : 'Translation failed')
      } finally {
        for (const id of pending) {
          inFlightRef.current.delete(translationKey(id, targetLanguage))
        }
        setLoadingIds((prev) => {
          const next = new Set(prev)
          for (const id of pending) next.delete(id)
          return next
        })
      }
    },
    [threadId]
  )

  const translateOneMessage = useCallback(
    async (messageId: string, targetLanguage: MessageTranslationTargetCode) => {
      setOverrides((prev) => ({
        ...prev,
        [messageId]: { language: targetLanguage, showOriginal: false },
      }))
      if (translationsRef.current[messageId]?.language === targetLanguage) {
        settledRef.current.add(translationKey(messageId, targetLanguage))
        return
      }
      // Allow a user-initiated retry even if auto-settle marked it failed
      settledRef.current.delete(translationKey(messageId, targetLanguage))
      await requestTranslations([messageId], targetLanguage, { force: true })
    },
    [requestTranslations]
  )

  const showOriginalForMessage = useCallback(
    (messageId: string, isOwnMessage: boolean) => {
      const override = overrides[messageId]
      if (override) {
        setOverrides((prev) => ({
          ...prev,
          [messageId]: { ...override, showOriginal: !override.showOriginal },
        }))
        return
      }
      if (!isOwnMessage && receiveLanguage !== 'off') {
        setOverrides((prev) => ({
          ...prev,
          [messageId]: { language: receiveLanguage, showOriginal: true },
        }))
      }
    },
    [overrides, receiveLanguage]
  )

  const getMessageLanguage = useCallback(
    (messageId: string, _isOwnMessage: boolean): MessageTranslationTargetCode | null => {
      return overrides[messageId]?.language ?? null
    },
    [overrides]
  )

  const getDisplayContent = useCallback(
    (
      message: ChatMessage,
      isOwnMessage: boolean
    ): { text: string; isTranslated: boolean; language: MessageTranslationTargetCode | null } => {
      const original = message.content ?? ''
      if (!isTextMessage(message)) {
        return { text: original, isTranslated: false, language: null }
      }

      const override = overrides[message.id]
      const activeLanguage = getMessageLanguage(message.id, isOwnMessage)

      if (!activeLanguage || override?.showOriginal) {
        return { text: original, isTranslated: false, language: activeLanguage }
      }

      const translated = translations[message.id]
      if (translated?.language === activeLanguage) {
        return { text: translated.text, isTranslated: true, language: activeLanguage }
      }

      return { text: original, isTranslated: false, language: activeLanguage }
    },
    [getMessageLanguage, overrides, translations]
  )

  const isTranslating = useCallback(
    (messageId: string) => loadingIds.has(messageId),
    [loadingIds]
  )

  const defaultOneClickLanguage: MessageTranslationTargetCode =
    receiveLanguage !== 'off' ? receiveLanguage : 'en'

  return {
    receiveLanguage,
    setReceiveLanguage,
    getDisplayContent,
    translateOneMessage,
    showOriginalForMessage,
    isTranslating,
    getMessageLanguage,
    overrides,
    defaultOneClickLanguage,
  }
}
