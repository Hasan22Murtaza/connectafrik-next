import { apiClient } from '@/lib/api-client'
import type {
  AdminCallRow,
  AdminContentFilter,
  AdminListingRow,
  AdminPlatformSettingRow,
  AdminPostRow,
  AdminReelRow,
  PaginatedAdminList,
} from '@/lib/admin/contentAdminService'

export type {
  AdminCallRow,
  AdminContentFilter,
  AdminListingRow,
  AdminPlatformSettingRow,
  AdminPostRow,
  AdminReelRow,
}

type ListParams = {
  page?: number
  limit?: number
  search?: string
  filter?: string
  status?: string
  type?: string
  include_stats?: boolean
}

async function listResource<T, S>(
  path: string,
  params?: ListParams
): Promise<PaginatedAdminList<T> & { stats: S | null }> {
  return apiClient.get(path, params)
}

export function listAdminPosts(params?: ListParams) {
  return listResource<
    AdminPostRow,
    { total: number; active: number; removed: number; last_7_days: number }
  >('/api/admin/posts', params)
}

export function listAdminReels(params?: ListParams) {
  return listResource<
    AdminReelRow,
    { total: number; active: number; removed: number; last_7_days: number }
  >('/api/admin/reels', params)
}

export function listAdminListings(params?: ListParams) {
  return listResource<
    AdminListingRow,
    {
      total: number
      available: number
      unavailable: number
      last_7_days: number
    }
  >('/api/admin/marketplace', params)
}

export function listAdminCalls(params?: ListParams) {
  return listResource<
    AdminCallRow,
    {
      total: number
      active: number
      failed: number
      missed: number
      last_7_days: number
    }
  >('/api/admin/calls', params)
}

export function getAdminSettings() {
  return apiClient.get<{
    settings: AdminPlatformSettingRow[]
    services: Array<{
      id: string
      label: string
      status: string
      detail: string
      response_ms: number | null
      last_checked: string
    }>
  }>('/api/admin/settings')
}

export function updateAdminSetting(key: string, value: number) {
  return apiClient.patch<{ setting: AdminPlatformSettingRow }>(
    '/api/admin/settings',
    { key, value }
  )
}
