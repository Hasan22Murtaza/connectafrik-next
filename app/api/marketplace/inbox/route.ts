import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  fetchMarketplaceInboxThreads,
  MarketplaceInboxLabel,
  MarketplaceInboxRole,
} from '@/lib/marketplaceChat'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)

    const role = (searchParams.get('role') || 'selling') as MarketplaceInboxRole
    const label = (searchParams.get('label') || 'all') as MarketplaceInboxLabel

    if (role !== 'selling' && role !== 'buying') {
      return errorResponse('role must be selling or buying', 400)
    }

    const data = await fetchMarketplaceInboxThreads(serviceClient, user.id, role, label)

    return jsonResponse({ data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch inbox'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('GET /api/marketplace/inbox error:', err)
    return errorResponse(message, 500)
  }
}
