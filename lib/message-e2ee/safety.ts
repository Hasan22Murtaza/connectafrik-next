function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const length = Math.min(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return left.length - right.length
}

function bytesFromKey(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(normalized + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 60 decimal digits from the two master public keys. The server is not asked. */
export async function safetyNumberDigits(leftKey: string, rightKey: string): Promise<string> {
  const left = bytesFromKey(leftKey)
  const right = bytesFromKey(rightKey)
  const [first, second] = compareBytes(left, right) <= 0 ? [left, right] : [right, left]
  const material = new Uint8Array(first.length + second.length)
  material.set(first, 0)
  material.set(second, first.length)
  let digest = new Uint8Array(await crypto.subtle.digest('SHA-512', material))
  for (let round = 0; round < 1000; round += 1) {
    const next = new Uint8Array(await crypto.subtle.digest('SHA-512', digest))
    digest = next
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
