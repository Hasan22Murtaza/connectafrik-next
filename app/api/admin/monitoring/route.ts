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
  getMonitoringSnapshot,
  type MonitoringRange,
} from '@/lib/admin/monitoringService'

const VALID_RANGES: MonitoringRange[] = ['24h', '7d', '30d', '90d']

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)

    const rangeParam = (searchParams.get('range') || '7d') as MonitoringRange
    const range = VALID_RANGES.includes(rangeParam) ? rangeParam : '7d'

    const snapshot = await getMonitoringSnapshot(serviceClient, {
      range,
      search: searchParams.get('search') || undefined,
      eventType: searchParams.get('event_type') || undefined,
      status: searchParams.get('status') || undefined,
      severity: searchParams.get('severity') || undefined,
    })

    return jsonResponse(snapshot)
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
