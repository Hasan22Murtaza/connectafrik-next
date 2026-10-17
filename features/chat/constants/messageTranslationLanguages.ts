export type MessageTranslationLanguageCode =
  | 'off'
  | 'en'
  | 'fr'
  | 'es'
  | 'pt'
  | 'de'
  | 'ar'
  | 'sw'
  | 'tw'
  | 'ee'
  | 'ha'
  | 'yo'
  | 'ig'
  | 'am'
  | 'hi'
  | 'zh'

export type MessageTranslationTargetCode = Exclude<MessageTranslationLanguageCode, 'off'>

export const MESSAGE_TRANSLATION_LANGUAGES: {
  code: MessageTranslationLanguageCode
  label: string
}[] = [
  { code: 'off', label: 'My language (default)' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic' },
  { code: 'sw', label: 'Swahili' },
  { code: 'tw', label: 'Twi (Akan)' },
  { code: 'ee', label: 'Ewe' },
  { code: 'ha', label: 'Hausa' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
  { code: 'am', label: 'Amharic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Chinese' },
]

export const MESSAGE_TRANSLATION_TARGET_LANGUAGES = MESSAGE_TRANSLATION_LANGUAGES.filter(
  (l): l is { code: MessageTranslationTargetCode; label: string } => l.code !== 'off'
)

export function isMessageTranslationLanguageCode(
  value: unknown
): value is MessageTranslationLanguageCode {
  return (
    typeof value === 'string' &&
    MESSAGE_TRANSLATION_LANGUAGES.some((l) => l.code === value)
  )
}

export function messageTranslationLanguageLabel(code: MessageTranslationLanguageCode): string {
  return MESSAGE_TRANSLATION_LANGUAGES.find((l) => l.code === code)?.label ?? code
}
