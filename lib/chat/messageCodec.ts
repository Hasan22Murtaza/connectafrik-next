const PREFIX = 'e2ee1.'
const SALT = 'cribstalk-message-v1'

const keyCache = new Map<string, Promise<CryptoKey>>()

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function threadKey(threadId: string): Promise<CryptoKey> {
  const cached = keyCache.get(threadId)
  if (cached) return cached
  const created = crypto.subtle
    .importKey('raw', new TextEncoder().encode(threadId), 'PBKDF2', false, ['deriveKey'])
    .then((material) =>
      crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode(SALT),
          iterations: 10000,
          hash: 'SHA-256',
        },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      )
    )
  keyCache.set(threadId, created)
  return created
}

export function isEncodedMessage(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/** Encrypt message text for chat_messages.content. Same thread decodes it for display. */
export async function encodeMessageContent(threadId: string, plaintext: string): Promise<string> {
  const key = await threadKey(threadId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )
  const packed = new Uint8Array(iv.byteLength + data.byteLength)
  packed.set(iv, 0)
  packed.set(new Uint8Array(data), iv.byteLength)
  return PREFIX + bytesToBase64(packed)
}

/** Turn stored content back into the text shown in the chat. Plaintext rows are left as they are. */
export async function decodeMessageContent(threadId: string, stored: string | null | undefined): Promise<string> {
  if (!stored || !isEncodedMessage(stored)) return stored || ''
  try {
    const packed = base64ToBytes(stored.slice(PREFIX.length))
    if (packed.byteLength < 13) return stored
    const key = await threadKey(threadId)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packed.slice(0, 12) },
      key,
      packed.slice(12)
    )
    return new TextDecoder().decode(plain)
  } catch {
    return stored
  }
}
