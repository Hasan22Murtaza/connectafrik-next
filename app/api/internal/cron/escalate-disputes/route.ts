import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyCronRequest, cronUnauthorizedResponse } from '@/lib/marketplace/cronAuth'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { escalateOverdueDisputes } from '@/lib/marketplace/disputeService'

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return cronUnauthorizedResponse()
  }

  try {
    const serviceClient = createServiceClient()
    const result = await escalateOverdueDisputes(serviceClient)
    return jsonResponse(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
