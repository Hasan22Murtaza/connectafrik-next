import { supabase } from '@/lib/supabase'

export interface PresenceStatus {
  id: string
  status: 'online' | 'away' | 'busy' | 'offline'
  lastSeen: string
  isTyping?: boolean
}

class PresenceService {
  private presenceChannel: any = null
  private statusUpdateInterval: NodeJS.Timeout | null = null

  // Initialize presence tracking
  async initializePresence(userId: string) {
    try {
      // Create a presence channel
      this.presenceChannel = supabase.channel('presence', {
        config: {
          presence: {
            key: userId,
          },
        },
      })

      // Track online status
      await this.presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = this.presenceChannel.presenceState()
          console.log('Presence state:', state)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }: { key: string, newPresences: any[] }) => {
          console.log('User joined:', key, newPresences)
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }: { key: string, leftPresences: any[] }) => {
          console.log('User left:', key, leftPresences)
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            const timestamp = new Date().toISOString()

            // Track in Realtime
            await this.presenceChannel.track({
              user_id: userId,
              status: 'online',
              last_seen: timestamp,
            })

            // Sync to database
            await this.updateDatabasePresence(userId, 'online')
          }
        })

      // Set up periodic status updates
      this.statusUpdateInterval = setInterval(() => {
        this.updatePresence(userId, 'online')
      }, 30000) // Update every 30 seconds

    } catch (error) {
      console.error('Failed to initialize presence:', error)
    }
  }

  // Update database presence (sync Realtime with database)
  private async updateDatabasePresence(userId: string, status: 'online' | 'away' | 'busy' | 'offline') {
    try {
      await supabase
        .from('profiles')
        .update({
          status,
          last_seen: new Date().toISOString()
        })
        .eq('id', userId)
    } catch (error) {
      console.error('Failed to update database presence:', error)
    }
  }

  // Update user presence status (both Realtime and database)
  async updatePresence(userId: string, status: 'online' | 'away' | 'busy' | 'offline') {
    if (!this.presenceChannel) return

    try {
      const timestamp = new Date().toISOString()

      // Update Realtime presence
      await this.presenceChannel.track({
        user_id: userId,
        status,
        last_seen: timestamp,
      })

      // Sync to database for persistent storage
      await this.updateDatabasePresence(userId, status)
    } catch (error) {
      console.error('Failed to update presence:', error)
    }
  }

  // Get online users
  async getOnlineUsers(): Promise<PresenceStatus[]> {
    if (!this.presenceChannel) return []

    try {
      const state = this.presenceChannel.presenceState()
      return Object.values(state).flat().map((presence: any) => ({
        id: presence.user_id,
        status: presence.status || 'online',
        lastSeen: presence.last_seen || new Date().toISOString(),
      }))
    } catch (error) {
      console.error('Failed to get online users:', error)
      return []
    }
  }

  // Set user as away (when tab becomes inactive)
  setAway(userId: string) {
    this.updatePresence(userId, 'away')
  }

  // Set user as busy
  setBusy(userId: string) {
    this.updatePresence(userId, 'busy')
  }

  // Clean up presence tracking
  async cleanup(userId?: string) {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval)
      this.statusUpdateInterval = null
    }

    // Mark user as offline in database before leaving
    if (userId) {
      await this.updateDatabasePresence(userId, 'offline')
    }

    if (this.presenceChannel) {
      await this.presenceChannel.unsubscribe()
      this.presenceChannel = null
    }
  }
}

export const presenceService = new PresenceService()

