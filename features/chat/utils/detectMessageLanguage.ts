import type { MessageTranslationTargetCode } from '@/features/chat/constants/messageTranslationLanguages'
import { stripMarkdown } from '@/features/chat/richtext/markdown'

/** Very short / ambiguous Latin chat tokens we treat as English. */
const ENGLISH_SHORT = new Set([
  'ok',
  'okay',
  'bye',
  'hi',
  'hey',
  'hello',
  'yes',
  'no',
  'yeah',
  'yep',
  'nope',
  'thanks',
  'thank',
  'pls',
  'please',
  'sure',
  'cool',
  'nice',
  'good',
  'morning',
  'night',
  'lol',
  'lmao',
  'omg',
  'idk',
  'imo',
  'bro',
  'dude',
  'wow',
  'ahh',
  'hmm',
  'yup',
  'np',
  'ty',
  'thx',
  'sup',
  'done',
  'wait',
  'stop',
  'go',
  'come',
  'see',
  'soon',
  'later',
])

const ENGLISH_MARKERS =
  /\b(the|and|you|are|is|was|were|have|has|had|this|that|with|for|from|your|what|when|where|why|how|will|would|could|should|about|just|like|really|thanks|please|hello|okay)\b/i

const FRENCH_MARKERS =
  /\b(bonjour|bonsoir|salut|merci|oui|non|je|tu|nous|vous|avec|pour|dans|sur|pas|une|des|les|mon|ma|mes|c'est|est-ce|j'ai|s'il|svp|comment|allez|bienvenue)\b/i

const SPANISH_MARKERS =
  /\b(hola|gracias|por|favor|que|qué|como|cómo|está|estas|buenos|buenas|días|noches|amigo|mucho|si|sí|también|necesito|quiero)\b/i

const PORTUGUESE_MARKERS =
  /\b(olá|ola|obrigado|obrigada|por|favor|você|voce|não|nao|sim|bom|dia|noite|tudo|bem|preciso|quero|como|está|esta)\b/i

const GERMAN_MARKERS =
  /\b(hallo|guten|tag|morgen|abend|nacht|bitte|danke|und|nicht|ich|du|wir|sie|mit|für|fur|das|der|die|ein|eine|ja|nein|wie|geht|schicken|sende|angebot|hilfe)\b/i

const SWAHILI_MARKERS =
  /\b(habari|asante|karibu|jambo|sawa|tafadhali|ndiyo|hapana|nina|naomba|rafiki|leo|kesho|asubuhi|usiku)\b/i

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/
const LATIN_LETTERS = /[A-Za-z\u00C0-\u024F]/

function normalizeForDetection(raw: string): string {
  return stripMarkdown(raw || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s'-]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Lightweight chat-oriented language guess.
 * Returns one of our translation codes, or null when unknown / not worth translating.
 */
export function detectChatMessageLanguage(
  raw: string
): MessageTranslationTargetCode | null {
  const text = normalizeForDetection(raw)
  if (!text) return null

  if (ARABIC_SCRIPT.test(text) && !LATIN_LETTERS.test(text.replace(ARABIC_SCRIPT, ''))) {
    return 'ar'
  }
  if (ARABIC_SCRIPT.test(text)) return 'ar'

  if (!LATIN_LETTERS.test(text)) return null

  const scores: Record<MessageTranslationTargetCode, number> = {
    en: 0,
    fr: 0,
    es: 0,
    pt: 0,
    de: 0,
    ar: 0,
    sw: 0,
  }

  if (FRENCH_MARKERS.test(text)) scores.fr += 3
  if (SPANISH_MARKERS.test(text)) scores.es += 3
  if (PORTUGUESE_MARKERS.test(text)) scores.pt += 3
  if (GERMAN_MARKERS.test(text)) scores.de += 3
  if (SWAHILI_MARKERS.test(text)) scores.sw += 3
  if (ENGLISH_MARKERS.test(text)) scores.en += 2

  const tokens = tokenize(text)
  if (tokens.length > 0 && tokens.every((t) => ENGLISH_SHORT.has(t) || /^\d+$/.test(t))) {
    scores.en += 4
  }

  // Accent clues
  if (/[àâçéèêëîïôùûüœæ]/i.test(text)) scores.fr += 1
  if (/[áéíóúñ¿¡]/i.test(text)) scores.es += 1
  if (/[ãõáàâêéíóôúç]/i.test(text)) scores.pt += 1
  if (/[äöüß]/i.test(text)) scores.de += 2

  let best: MessageTranslationTargetCode = 'en'
  let bestScore = -1
  for (const code of Object.keys(scores) as MessageTranslationTargetCode[]) {
    if (scores[code] > bestScore) {
      bestScore = scores[code]
      best = code
    }
  }

  // No strong signal → default Latin chat to English (hide Translate to English)
  if (bestScore <= 0) return 'en'
  return best
}

/**
 * Show the under-message "Translate to …" control only when the text
 * does not already look like the target language.
 */
export function shouldOfferMessageTranslate(
  raw: string,
  targetLanguage: MessageTranslationTargetCode
): boolean {
  const detected = detectChatMessageLanguage(raw)
  if (!detected) return false
  return detected !== targetLanguage
}
