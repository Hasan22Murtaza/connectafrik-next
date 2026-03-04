import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()

    const status = body.status as string | undefined
    const last_seen = body.last_seen as string | undefined

    const validStatuses = ['online', 'away', 'busy', 'offline']
    if (status && !validStatuses.includes(status)) {
      return errorResponse('Invalid status. Must be one of: online, away, busy, offline', 400)
    }

    const updateData: Record<string, any> = {}
    if (status) updateData.status = status
    updateData.last_seen = last_seen || new Date().toISOString()

    const { error } = await serviceClient
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ success: true, status: updateData.status, last_seen: updateData.last_seen })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
