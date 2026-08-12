import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  emptyFeedbackStats,
  getFeedbackStats,
  isFeedbackStatus,
  isFeedbackType,
  listFeedback,
} from '@/lib/feedback/feedbackService'
import type { FeedbackStatus, FeedbackType } from '@/lib/feedback/types'

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)

    const statusParam = searchParams.get('status') || 'all'
    const typeParam = searchParams.get('type') || 'all'
    const search = searchParams.get('search') || undefined
    const dateFrom = searchParams.get('date_from') || undefined
    const dateTo = searchParams.get('date_to') || undefined
    const page = Number(searchParams.get('page') || 0)
    const limit = Number(searchParams.get('limit') || 20)
    const includeStats = searchParams.get('include_stats') !== 'false'

    const status =
      statusParam === 'all' || isFeedbackStatus(statusParam)
        ? (statusParam as FeedbackStatus | 'all')
        : 'all'
    const type =
      typeParam === 'all' || isFeedbackType(typeParam)
        ? (typeParam as FeedbackType | 'all')
        : 'all'

    const [{ items, total }, stats] = await Promise.all([
      listFeedback(serviceClient, {
        status,
        type,
        search,
        date_from: dateFrom,
        date_to: dateTo,
        page: Number.isFinite(page) ? page : 0,
        limit: Number.isFinite(limit) ? limit : 20,
      }),
      includeStats ? getFeedbackStats(serviceClient) : Promise.resolve(emptyFeedbackStats()),
    ])

    return jsonResponse({
      items,
      total,
      page: Number.isFinite(page) ? page : 0,
      limit: Number.isFinite(limit) ? limit : 20,
      stats,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return forbiddenResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
