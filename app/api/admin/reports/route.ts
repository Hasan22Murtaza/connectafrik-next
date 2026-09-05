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
  emptyReportStats,
  getReportStats,
  isPostReportReason,
  isPostReportStatus,
  listReportGroups,
} from '@/lib/reports/reportService'
import type { PostReportReason, PostReportStatus } from '@/lib/reports/types'

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)

    const statusParam = searchParams.get('status') || 'all'
    const reasonParam = searchParams.get('reason') || 'all'
    const search = searchParams.get('search') || undefined
    const dateFrom = searchParams.get('date_from') || undefined
    const dateTo = searchParams.get('date_to') || undefined
    const author = searchParams.get('author') || undefined
    const minReports = Number(searchParams.get('min_reports') || 0)
    const page = Number(searchParams.get('page') || 0)
    const limit = Number(searchParams.get('limit') || 20)
    const includeStats = searchParams.get('include_stats') !== 'false'

    const status =
      statusParam === 'all' || isPostReportStatus(statusParam)
        ? (statusParam as PostReportStatus | 'all')
        : 'all'
    const reason =
      reasonParam === 'all' || isPostReportReason(reasonParam)
        ? (reasonParam as PostReportReason | 'all')
        : 'all'

    const [{ items, total }, stats] = await Promise.all([
      listReportGroups(serviceClient, {
        status,
        reason,
        search,
        date_from: dateFrom,
        date_to: dateTo,
        author,
        min_reports: Number.isFinite(minReports) ? minReports : 0,
        page: Number.isFinite(page) ? page : 0,
        limit: Number.isFinite(limit) ? limit : 20,
      }),
      includeStats ? getReportStats(serviceClient) : Promise.resolve(emptyReportStats()),
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
