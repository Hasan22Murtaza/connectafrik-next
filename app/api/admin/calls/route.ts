import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import {
  jsonResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/api-utils'
import {
  getAdminCallsStats,
  listAdminCalls,
} from '@/lib/admin/contentAdminService'

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const client = createServiceClient()
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('include_stats') === 'true'

    const [list, stats] = await Promise.all([
      listAdminCalls(client, {
        page: parseInt(searchParams.get('page') || '0', 10),
        limit: parseInt(searchParams.get('limit') || '20', 10),
        search: searchParams.get('search') || undefined,
        status: searchParams.get('status') || undefined,
      }),
      includeStats ? getAdminCallsStats(client) : Promise.resolve(null),
    ])

    return jsonResponse({ ...list, stats })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500)
  }
}
