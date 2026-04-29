/**
 * Participant JWT for VideoSDK (roomId + userId). Shared by /api/videosdk/token and /api/videosdk/room.
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function base64UrlEncodeFromBuffer(buffer: ArrayBuffer): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function getVideosdkCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey =
    process.env.VIDEOSDK_API_KEY ??
    process.env.VITE_VIDEOSDK_API_KEY ??
    process.env.NEXT_PUBLIC_VIDEOSDK_API_KEY
  const apiSecret =
    process.env.VIDEOSDK_SECRET_KEY ??
    process.env.VIDEOSDK_SECRET ??
    process.env.VITE_VIDEOSDK_SECRET_KEY ??
    process.env.NEXT_PUBLIC_VIDEOSDK_SECRET_KEY
  if (!apiKey || !apiSecret) {
    throw new Error('Missing VideoSDK credentials')
  }
  return { apiKey, apiSecret }
}

export async function generateVideosdkParticipantJwt(
  roomId: string,
  userId: string,
): Promise<string> {
  const { apiKey, apiSecret } = getVideosdkCredentials()

  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    apikey: apiKey,
    permissions: ['allow_join', 'allow_mod'],
    version: 2,
    roomId,
    userId,
    exp: now + 600,
    iat: now,
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signatureInput = `${encodedHeader}.${encodedPayload}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signatureInput),
  )
  const encodedSignature = base64UrlEncodeFromBuffer(signature)

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}
