export type MessageTranslationLanguageCode =
  | 'off'
  | 'en'
  | 'fr'
  | 'es'
  | 'pt'
  | 'de'
  | 'ar'
  | 'sw'

export type MessageTranslationTargetCode = Exclude<MessageTranslationLanguageCode, 'off'>

export const MESSAGE_TRANSLATION_LANGUAGES: {
  code: MessageTranslationLanguageCode
  label: string
}[] = [
  { code: 'off', label: 'Off (original language)' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic' },
  { code: 'sw', label: 'Swahili' },
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
