function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const length = Math.min(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    if (left[i] !== right[i]) return left[i]! - right[i]!
  }
  return left.length - right.length
}

function decodeBase64Key(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  if (!normalized || /[^A-Za-z0-9+/=]/.test(normalized)) {
    throw new Error('bad-key')
  }
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  let binary: string
  try {
    binary = atob(normalized + pad)
  } catch {
    throw new Error('bad-key')
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 60 decimal digits from two Signal identity public keys. */
export async function safetyNumberDigits(leftKey: string, rightKey: string): Promise<string> {
  let left: Uint8Array
  let right: Uint8Array
  try {
    left = decodeBase64Key(leftKey)
    right = decodeBase64Key(rightKey)
  } catch {
    throw new Error('Could not build the safety number from these encryption keys.')
  }
  const [first, second] = compareBytes(left, right) <= 0 ? [left, right] : [right, left]
  const material = new Uint8Array(first.length + second.length)
  material.set(first, 0)
  material.set(second, first.length)
  let digest = new Uint8Array(await crypto.subtle.digest('SHA-512', material))
  for (let round = 0; round < 1000; round += 1) {
    digest = new Uint8Array(await crypto.subtle.digest('SHA-512', digest))
  }
  let value = BigInt(0)
  for (const byte of digest) value = (value << BigInt(8)) + BigInt(byte)
  return (value % (BigInt(10) ** BigInt(60))).toString(10).padStart(60, '0')
}

export function formatSafetyNumber(digits: string): string[] {
  const groups: string[] = []
  for (let i = 0; i < digits.length; i += 5) groups.push(digits.slice(i, i + 5))
  return groups
}

export function friendlySafetyError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/atob|incorrectly encoded|bad-key|Could not build the safety number from/i.test(message)) {
    return 'The safety number is not ready yet. Ask the other person to open this chat once, then try again.'
  }
  if (/not set up encryption|off$/i.test(message)) {
    return 'That person has not set up encryption on a device yet.'
  }
  return message || 'Could not build the safety number'
}
