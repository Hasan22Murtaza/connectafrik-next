import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { requireProfileAccess } from '../_shared/resolve-user-request'
import { fetchConnectionsForOwner } from '../_shared/connections-data'

/** Friends list for the profile Friends tab (same data as `/connections`). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    const access = await requireProfileAccess(request, identifier)
    if (!access.ok) return access.response

    const data = await fetchConnectionsForOwner(access.ctx.supabase, access.ctx.ownerId)
    return jsonResponse({ data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch friends'
    return errorResponse(message, 500)
  }
}
