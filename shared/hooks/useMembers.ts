import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
export interface Member {
  id: string
  name: string
  avatar_url?: string
  username?: string
  /** Raw `profiles.status` (may be legacy values); use `deriveUserPresence` in UI. */
  status?: string | null
  last_seen?: string | null
}

const normalizedName = (fullName?: string | null, username?: string | null) => {
  const byFullName = fullName?.trim()
  if (byFullName) return byFullName
  const byUsername = username?.trim()
  if (byUsername) return byUsername
  return 'ConnectAfrik Member'
}

export function useMembers(enabled: boolean = true) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) {
      setMembers([])
      setLoading(false)
      return
    }

    const fetchMembers = async () => {
      try {
        const res = await apiClient.get<{ data: any[] }>('/api/users/members')
        const data = res?.data || []

        setMembers(
          data.map((profile: any) => ({
            id: profile.id,
            name: normalizedName(profile.full_name, profile.username),
            avatar_url: profile.avatar_url ?? undefined,
            username: profile.username ?? undefined,
            status: profile.status ?? null,
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
  }, [enabled])

  return { members, loading }
}
