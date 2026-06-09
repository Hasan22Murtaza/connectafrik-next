import { NextRequest } from 'next/server'
import { errorResponse } from '@/lib/api-utils'

export function verifyCronRequest(request: NextRequest): boolean {
  const secret =
    process.env.MARKETPLACE_CRON_SECRET ||
    process.env.CRON_SECRET

  if (!secret) {
    console.warn('MARKETPLACE_CRON_SECRET / CRON_SECRET not configured')
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  return token === secret
}

export function cronUnauthorizedResponse() {
  return errorResponse('Unauthorized cron request', 401)
}
