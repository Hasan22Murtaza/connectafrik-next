import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { requireProfileAccess } from '../_shared/resolve-user-request'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    const access = await requireProfileAccess(request, identifier)
    if (!access.ok) return access.response

    return jsonResponse({ data: access.ctx.profile })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch about'
    return errorResponse(message, 500)
  }
}
