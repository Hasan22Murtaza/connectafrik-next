import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { isPostReportReason } from '@/lib/reports/reportService'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { id: reelId } = await context.params
    const body = await request.json().catch(() => ({}))
    const reason = body?.reason

    if (!isPostReportReason(reason)) {
      return errorResponse('Please select a valid report reason', 400)
    }

    const supabase = createServiceClient()

    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .select('id, author_id, is_deleted')
      .eq('id', reelId)
      .maybeSingle()

    if (reelError) return errorResponse(reelError.message, 400)
    if (!reel || reel.is_deleted) return errorResponse('Reel not found', 404)
    if (reel.author_id === user.id) {
      return errorResponse('You cannot report your own reel', 400)
    }

    const { data: existing } = await supabase
      .from('reel_reports')
      .select('id')
      .eq('reel_id', reelId)
      .eq('reported_by', user.id)
      .eq('reason', reason)
      .maybeSingle()

    if (existing) {
      return errorResponse('You have already reported this reel for this reason', 409)
    }

    const { error: insertError } = await supabase.from('reel_reports').insert({
      reel_id: reelId,
      reported_by: user.id,
      reason,
    })

    if (insertError) return errorResponse(insertError.message, 400)

    return jsonResponse(
      { submitted: true },
      201,
      "Thanks for reporting. We'll review this reel."
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit report'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
