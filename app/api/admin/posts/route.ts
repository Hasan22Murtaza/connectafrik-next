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
  getAdminPostsStats,
  listAdminPosts,
  type AdminContentFilter,
} from '@/lib/admin/contentAdminService'

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const client = createServiceClient()
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('include_stats') === 'true'
    const filter = (searchParams.get('filter') || 'all') as AdminContentFilter

    const [list, stats] = await Promise.all([
      listAdminPosts(client, {
        page: parseInt(searchParams.get('page') || '0', 10),
        limit: parseInt(searchParams.get('limit') || '20', 10),
        search: searchParams.get('search') || undefined,
        filter,
      }),
      includeStats ? getAdminPostsStats(client) : Promise.resolve(null),
    ])

    return jsonResponse({ ...list, stats })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500)
  }
}
