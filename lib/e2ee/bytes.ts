/** Browser-safe base64 helpers. No private keys are logged. */

export function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

export function copyBuffer(buffer: ArrayBuffer): ArrayBuffer {
  return buffer.slice(0)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer))
}

export function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function binaryStringToBase64(value: string): string {
  const bytes = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i) & 0xff
  return bytesToBase64(bytes)
}

export function sameBytes(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false
  const left = new Uint8Array(a)
  const right = new Uint8Array(b)
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false
  }
  return true
}

/** Signal public identity / prekeys are 33 bytes and start with the 0x05 DJB type byte. */
export function isSignalPublicKey(base64: string): boolean {
  try {
    const bytes = new Uint8Array(base64ToArrayBuffer(base64))
    return bytes.byteLength === 33 && bytes[0] === 5
  } catch {
    return false
  }
}

export function isSignalSignature(base64: string): boolean {
  try {
    return new Uint8Array(base64ToArrayBuffer(base64)).byteLength === 64
  } catch {
    return false
  }
}
