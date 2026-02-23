import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error: updateError } = await supabase
      .from('group_memberships')
      .update({ status: 'left' })
      .eq('group_id', groupId)
      .eq('user_id', user.id)

    if (updateError) {
      return errorResponse(updateError.message, 400)
    }

    const { count } = await supabase
      .from('group_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active')

    const memberCount = count ?? 0

    supabase
      .from('groups')
      .update({ member_count: memberCount })
      .eq('id', groupId)
      .then(({ error: syncError }) => {
        if (syncError) console.error('Failed to update member_count:', syncError)
      })

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to leave group', 500)
  }
}
