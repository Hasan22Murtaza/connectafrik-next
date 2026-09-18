import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { filterSearchableUserIds, getRelationships } from '@/lib/privacy/access'
import { sanitizePresenceFields } from '@/lib/privacy/sanitize'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, status, last_seen')
      .order('username', { ascending: true })

    if (error) return errorResponse(error.message, 400)
    const rows = data || []
    const visibleIds = await filterSearchableUserIds(
      user.id,
      rows.map((p: { id: string }) => p.id),
      supabase
    )
    const rels = await getRelationships(user.id, [...visibleIds], supabase)
    const sanitized = rows
      .filter((p: { id: string }) => visibleIds.has(p.id))
      .map((p: any) => {
        const rel = rels.get(p.id)
        const presence = rel
          ? sanitizePresenceFields(p, user.id, rel)
          : { status: null, last_seen: null }
        return { ...p, status: presence.status, last_seen: presence.last_seen }
      })
    return jsonResponse({ data: sanitized })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch members', 500)
  }
}
