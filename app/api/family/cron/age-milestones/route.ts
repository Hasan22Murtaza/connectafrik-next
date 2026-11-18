import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { jsonResponse } from '@/lib/api-utils'
import { cronUnauthorizedResponse, verifyCronRequest } from '@/lib/marketplace/cronAuth'
import { processAllChildAgeMilestones } from '@/lib/family'

/** Daily cron: email parents at 16+, auto-promote Child → Teen at 18. */
export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return cronUnauthorizedResponse()
  }

  const service = createServiceClient()
  const result = await processAllChildAgeMilestones(service)
  return jsonResponse(result)
}

export async function GET(request: NextRequest) {
  return POST(request)
}
