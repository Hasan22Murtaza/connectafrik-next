// Lightweight helpers for VideoSDK token handling.
// These keep the app compiling even when the real SDK helpers aren't present.

const EDGE_FUNCTION_URL =
  'https://jsggugavfanjrqdjsxbt.functions.supabase.co/generate-videosdk-token'

interface FetchVideoSDKTokenParams {
  roomId: string
  userId: string
}

/**
 * Fetch a VideoSDK JWT token from the Supabase Edge Function.
 * Throws if the request fails or no token is returned.
 */
export const fetchVideoSDKToken = async ({
  roomId,
  userId,
}: FetchVideoSDKTokenParams): Promise<string> => {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, userId }),
  })

  if (!response.ok) {
    throw new Error('Failed to get VideoSDK token')
  }

  const data = await response.json()
  if (!data?.token || typeof data.token !== 'string') {
    throw new Error('No VideoSDK token returned from Edge Function')
  }

  return data.token
}

/**
 * Basic compatibility check – ensures both values exist and share a prefix.
 * This is a minimal guard to keep the codepath intact.
 */
export const isVideoSDKTokenCompatible = (
  token?: string | null,
  apiKey?: string | null,
): boolean => {
  if (!token || !apiKey) return false
  return token.slice(0, 6) === apiKey.slice(0, 6)
}

