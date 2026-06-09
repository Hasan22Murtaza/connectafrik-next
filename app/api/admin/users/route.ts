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
  getAdminUserStats,
  listAdminUsers,
  type AdminUserFilter,
  type AdminUserSortField,
} from '@/lib/marketplace/adminUserService'

const VALID_FILTERS: AdminUserFilter[] = [
  'all',
  'sellers',
  'buyers',
  'verified',
  'unverified',
  'active',
  'suspended',
  'new',
]

const VALID_SORT_FIELDS: AdminUserSortField[] = [
  'created_at',
  'full_name',
  'username',
  'last_login',
]

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)

    const includeStats = searchParams.get('include_stats') === 'true'
    const filter = (searchParams.get('filter') || 'all') as AdminUserFilter
    const sortBy = (searchParams.get('sort_by') || 'created_at') as AdminUserSortField
    const sortDir = searchParams.get('sort_dir') === 'asc' ? 'asc' : 'desc'

    if (!VALID_FILTERS.includes(filter)) {
      return errorResponse('Invalid filter', 400)
    }
    if (!VALID_SORT_FIELDS.includes(sortBy)) {
      return errorResponse('Invalid sort field', 400)
    }

    const [listResult, stats] = await Promise.all([
      listAdminUsers(serviceClient, {
        filter,
        search: searchParams.get('search') || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page: parseInt(searchParams.get('page') || '0', 10),
        limit: parseInt(searchParams.get('limit') || '20', 10),
      }),
      includeStats ? getAdminUserStats(serviceClient) : Promise.resolve(null),
    ])

    return jsonResponse({
      ...listResult,
      stats,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
