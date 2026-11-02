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
  listAdminPlatformSettings,
  upsertAdminPlatformSetting,
} from '@/lib/admin/contentAdminService'
import { getMonitoringSnapshot } from '@/lib/admin/monitoringService'

export async function GET(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const client = createServiceClient()
    const [settings, snapshot] = await Promise.all([
      listAdminPlatformSettings(client),
      getMonitoringSnapshot(client, { range: '24h' }),
    ])

    return jsonResponse({
      settings,
      services: snapshot.services,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireMarketplaceAdmin(request)
    const client = createServiceClient()
    const body = await request.json()
    const key = String(body?.key || '')
    const value = Number(body?.value)

    const setting = await upsertAdminPlatformSetting(client, key, value)
    return jsonResponse({ setting })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') return unauthorizedResponse()
    if (error instanceof Error && error.message === 'Forbidden') return forbiddenResponse()
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 400)
  }
}
