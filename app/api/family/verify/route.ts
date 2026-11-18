import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { approveFamilyVerificationByToken } from '@/lib/family'

/** Approve a parent verification request via emailed token (birthday change / child removal). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    if (!token) return errorResponse('token is required', 400)

    const service = createServiceClient()
    const result = await approveFamilyVerificationByToken(service, token)
    return jsonResponse(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    return errorResponse(message, 400)
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token')?.trim() || ''
    if (!token) return errorResponse('token is required', 400)

    const service = createServiceClient()
    const result = await approveFamilyVerificationByToken(service, token)
    return jsonResponse(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    return errorResponse(message, 400)
  }
}
