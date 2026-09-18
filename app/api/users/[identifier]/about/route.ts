import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { requireProfileAccess } from '../_shared/resolve-user-request'
import { sanitizeProfileForViewer } from '@/lib/privacy/sanitize'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    const access = await requireProfileAccess(request, identifier)
    if (!access.ok) return access.response

    const sanitized = sanitizeProfileForViewer(
      access.ctx.profile,
      access.ctx.viewerId,
      access.ctx.relationship
    )
    return jsonResponse({ data: sanitized })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch about'
    return errorResponse(message, 500)
  }
}
