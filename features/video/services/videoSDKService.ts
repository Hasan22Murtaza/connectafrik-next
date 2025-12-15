import { fetchVideoSDKToken, isVideoSDKTokenCompatible } from '@/lib/videosdk'

export interface JoinVideoSDKRoomResult {
  token: string
  roomId: string
  userId: string
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
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
