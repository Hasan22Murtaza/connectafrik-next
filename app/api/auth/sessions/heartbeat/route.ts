import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { deviceLabelFromUserAgent } from '@/shared/utils/sessionDeviceLabel'

const MAX_LABEL = 160

function sessionIdFromAccessToken(accessToken: string): string | null {
  const d = jwt.decode(accessToken) as { session_id?: string } | null
  return typeof d?.session_id === 'string' ? d.session_id : null
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return errorResponse('Missing token', 401)

    const { user } = await getAuthenticatedUser(request)
    const sessionId = sessionIdFromAccessToken(token)
    if (!sessionId) return errorResponse('No session id in token', 400)

    const body = await request.json().catch(() => ({}))
    let label = typeof body.deviceLabel === 'string' ? body.deviceLabel.trim() : ''
    if (label.length > MAX_LABEL) label = label.slice(0, MAX_LABEL)
    if (!label) {
      const ua = typeof body.userAgent === 'string' ? body.userAgent : ''
      label = deviceLabelFromUserAgent(ua || null)
    }
    if (!label || label === 'Unknown device') {
      label = 'Signed-in device'
    }

    const serviceClient = createServiceClient()
    const { error } = await serviceClient.from('auth_session_device_labels').upsert(
      {
        user_id: user.id,
        session_id: sessionId,
        device_label: label,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_id' }
    )

    if (error) {
      return errorResponse(error.message || 'Failed to save device label', 500)
    }

    return jsonResponse({ ok: true })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorizedResponse()
    const message = err instanceof Error ? err.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
