import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PresenceStatus } from '@/shared/types/chat'

export interface Member {
  id: string
  name: string
  avatar_url?: string
  username?: string
  status?: PresenceStatus | null
  last_seen?: string | null
}

export const REAL_MEMBER_USERNAMES = ['stsedze', 'rtsedze'] as const

const normalizedName = (fullName?: string | null, username?: string | null) => {
  const byFullName = fullName?.trim()
  if (byFullName) return byFullName
  const byUsername = username?.trim()
  if (byUsername) return byUsername
  return 'ConnectAfrik Member'
}

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, status, last_seen')
          .order('username', { ascending: true })

        if (error) {
          console.error('Failed to load members:', error)
          setMembers([])
          return
        }

        const targetUsernames = new Set(
          REAL_MEMBER_USERNAMES.map((name) => name.toLowerCase())
        )

        const filtered = (data ?? []).filter((profile: any) => {
          const username = (profile.username ?? '').toLowerCase()
          return targetUsernames.has(username)
        })

        setMembers(
          filtered.map((profile: any) => ({
            id: profile.id,
            name: normalizedName(profile.full_name, profile.username),
            avatar_url: profile.avatar_url ?? undefined,
            username: profile.username ?? undefined,
            status: (profile.status ?? null) as PresenceStatus | null,
            last_seen: profile.last_seen ?? null,
          }))
        )
      } catch (caughtError) {
        console.error('Unexpected error loading members:', caughtError)
        setMembers([])
      } finally {
        setLoading(false)
      }
    }

    fetchMembers()
  }, [])

  return { members, loading }
}
