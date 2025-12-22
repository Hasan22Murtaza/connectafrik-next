export interface JoinVideoSDKRoomResult {
  token: string
  roomId: string
  userId: string
}

/**
 * Basic compatibility check – ensures both values exist and share a prefix.
 */
const isVideoSDKTokenCompatible = (
  token?: string | null,
  apiKey?: string | null,
): boolean => {
  if (!token || !apiKey) return false
  return token.slice(0, 6) === apiKey.slice(0, 6)
}

/**
 * Fetch a VideoSDK JWT token from the API endpoint.
 */
const fetchVideoSDKToken = async ({
  roomId,
  userId,
}: { roomId: string; userId: string }): Promise<string> => {
  const response = await fetch('/api/videosdk/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, userId }),
  })

  if (!response.ok) {
    throw new Error('Failed to get VideoSDK token')
  }

  const data = await response.json()
  console.log('VideoSDK token data:36', data)
  if (!data?.token || typeof data.token !== 'string') {
    throw new Error('No VideoSDK token returned from API')
  }

  return data.token
}

class VideoSDKService {
  private static instance: VideoSDKService
  private currentRoom: JoinVideoSDKRoomResult | null = null

  static getInstance(): VideoSDKService {
    if (!VideoSDKService.instance) {
      VideoSDKService.instance = new VideoSDKService()
    }
    return VideoSDKService.instance
  }

  async createRoom(roomId?: string): Promise<string> {
    if (roomId) {
      return roomId
    }
    
    // Create room via VideoSDK API
    try {
      const response = await fetch('/api/videosdk/room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create room')
      }

      const data = await response.json()
      if (!data.roomId) {
        throw new Error('Room ID not found in response')
      }

      return data.roomId
    } catch (error) {
      console.error('Error creating VideoSDK room:', error)
      throw error
    }
  }

  async joinRoom(roomId: string, userId: string, tokenHint?: string): Promise<JoinVideoSDKRoomResult> {
    const configuredApiKey =
      (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_VIDEOSDK_API_KEY : undefined) ??
      (typeof process !== 'undefined' ? process.env?.VITE_VIDEOSDK_API_KEY : undefined)

    if (tokenHint && configuredApiKey && isVideoSDKTokenCompatible(tokenHint, configuredApiKey)) {
      const result: JoinVideoSDKRoomResult = { token: tokenHint, roomId, userId }
      this.currentRoom = result
      return result
    }

    const token = await fetchVideoSDKToken({ roomId, userId })
    const result: JoinVideoSDKRoomResult = { token, roomId, userId }
    this.currentRoom = result
    return result
  }

  leaveRoom(): void {
    this.currentRoom = null
  }

  getCurrentRoom(): JoinVideoSDKRoomResult | null {
    return this.currentRoom
  }

  getCurrentToken(): string | null {
    return this.currentRoom?.token ?? null
  }

  async getToken(roomId: string): Promise<string | null> {
    try {
      const result = await this.joinRoom(roomId, 'user_' + Date.now())
      return result.token
    } catch (error) {
      console.error('Error getting VideoSDK token:', error)
      return null
    }
  }
}

export const videoSDKService = VideoSDKService.getInstance()
