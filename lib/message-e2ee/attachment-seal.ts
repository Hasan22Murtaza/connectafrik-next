/** CLA1 wire format: chunked AES-GCM attachment sealing for E2EE chats. */

const MAGIC = [0x43, 0x4c, 0x41, 0x31] // CLA1

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
const VERSION = 1
const CHUNK_SIZE = 65536
const HEADER_BYTES = 4 + 1 + 4 + 8 + 32

export type SealedAttachmentMeta = {
  key: string
  sha256: string
  plainSize: number
  plainName: string
  plainMime: string
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, false)
}

function writeUint64(view: DataView, offset: number, value: number) {
  view.setUint32(offset, Math.floor(value / 0x100000000), false)
  view.setUint32(offset + 4, value >>> 0, false)
}

function readUint64(view: DataView, offset: number): number {
  const high = view.getUint32(offset, false)
  const low = view.getUint32(offset + 4, false)
  return high * 0x100000000 + low
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bufferOf(bytes)))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sealAttachment(file: File): Promise<{ bytes: Uint8Array; meta: SealedAttachmentMeta }> {
  const plain = new Uint8Array(await file.arrayBuffer())
  const keyBytes = crypto.getRandomValues(new Uint8Array(32))
  const key = await crypto.subtle.importKey('raw', bufferOf(keyBytes), 'AES-GCM', false, ['encrypt'])
  const hash = await sha256Hex(plain)
  const parts: Uint8Array[] = []
  for (let offset = 0; offset < plain.length; offset += CHUNK_SIZE) {
    const slice = plain.subarray(offset, Math.min(offset + CHUNK_SIZE, plain.length))
    const nonce = crypto.getRandomValues(new Uint8Array(12))
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bufferOf(nonce) }, key, bufferOf(slice)),
    )
    const chunk = new Uint8Array(nonce.length + sealed.length)
    chunk.set(nonce, 0)
    chunk.set(sealed, nonce.length)
    parts.push(chunk)
  }
  const bodyLength = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(HEADER_BYTES + bodyLength)
  out.set(MAGIC, 0)
  const view = new DataView(out.buffer)
  out[4] = VERSION
  writeUint32(view, 5, CHUNK_SIZE)
  writeUint64(view, 9, plain.length)
  const hashBytes = new Uint8Array(hash.match(/../g)!.map((pair) => parseInt(pair, 16)))
  out.set(hashBytes, 17)
  let cursor = HEADER_BYTES
  for (const part of parts) {
    out.set(part, cursor)
    cursor += part.length
  }
  return {
    bytes: out,
    meta: {
      key: bytesToBase64(keyBytes),
      sha256: hash,
      plainSize: plain.length,
      plainName: file.name,
      plainMime: file.type || 'application/octet-stream',
    },
  }
}

export async function openAttachment(
  sealed: Uint8Array,
  keyBase64: string,
  expectedSha256: string,
): Promise<Blob> {
  if (sealed.length < HEADER_BYTES) throw new Error('truncated')
  if (sealed[0] !== MAGIC[0] || sealed[1] !== MAGIC[1] || sealed[2] !== MAGIC[2] || sealed[3] !== MAGIC[3]) {
    throw new Error('format')
  }
  if (sealed[4] !== VERSION) throw new Error('version')
  const view = new DataView(sealed.buffer, sealed.byteOffset, sealed.byteLength)
  const chunkSize = view.getUint32(5, false)
  const plainSize = readUint64(view, 9)
  if (!Number.isFinite(plainSize) || plainSize < 0 || chunkSize < 1 || chunkSize > 1024 * 1024) {
    throw new Error('header')
  }
  const key = await crypto.subtle.importKey('raw', bufferOf(base64ToBytes(keyBase64)), 'AES-GCM', false, [
    'decrypt',
  ])
  const plain = new Uint8Array(plainSize)
  let read = HEADER_BYTES
  let written = 0
  while (written < plainSize) {
    if (read + 12 + 16 > sealed.length) throw new Error('truncated')
    const remaining = plainSize - written
    const sliceLen = Math.min(chunkSize, remaining)
    const sealedLen = sliceLen + 16
    const nonce = sealed.subarray(read, read + 12)
    const data = sealed.subarray(read + 12, read + 12 + sealedLen)
    const opened = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bufferOf(nonce) }, key, bufferOf(data)),
    )
    if (opened.length !== sliceLen) throw new Error('chunk')
    plain.set(opened, written)
    written += opened.length
    read += 12 + sealedLen
  }
  const actual = await sha256Hex(plain)
  if (actual !== expectedSha256) throw new Error('hash')
  return new Blob([bufferOf(plain)])
}
