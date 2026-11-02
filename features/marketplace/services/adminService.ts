import { apiClient } from '@/lib/api-client'

export async function startStripeConnectOnboarding(): Promise<{ url: string }> {
  const result = await apiClient.post<{ data: { url: string } }>(
    '/api/marketplace/seller/stripe-connect/onboard',
    {}
  )
  return result.data
}

export async function getStripeConnectStatus() {
  const result = await apiClient.get<{ data: Record<string, unknown> }>(
    '/api/marketplace/seller/stripe-connect/status'
  )
  return result.data
}

export type AdminUserAccountStatus = 'active' | 'suspended'
export type AdminUserFilter =
  | 'all'
  | 'verified'
  | 'unverified'
  | 'active'
  | 'suspended'
  | 'new'

export type AdminUserSortField = 'created_at' | 'full_name' | 'username' | 'last_login'

export interface AdminUserStats {
  total_users: number
  new_users_today: number
  new_users_this_week: number
  active_users: number
  verified_users: number
}

export interface AdminUserListItem {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  email: string | null
  is_verified: boolean
  created_at: string
  last_login: string | null
  account_status: AdminUserAccountStatus
}

export interface AdminUserDetail extends AdminUserListItem {
  phone_number: string | null
  country: string | null
  city: string | null
  address: string | null
  state: string | null
  bio: string | null
  platform_role: string
  last_active_at: string | null
  last_seen: string | null
}

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  limit: number
}

export interface AdminUsersListResult extends PaginatedResult<AdminUserListItem> {
  stats: AdminUserStats | null
}

export async function listAdminUsers(params?: {
  filter?: AdminUserFilter
  search?: string
  sort_by?: AdminUserSortField
  sort_dir?: 'asc' | 'desc'
  page?: number
  limit?: number
  include_stats?: boolean
}): Promise<AdminUsersListResult> {
  const result = await apiClient.get<AdminUsersListResult>(
    '/api/admin/users',
    params
  )
  return result
}

export async function getAdminUser(userId: string): Promise<AdminUserDetail> {
  const result = await apiClient.get<{ data: AdminUserDetail }>(
    `/api/admin/users/${userId}`
  )
  return result.data
}

export async function suspendAdminUser(userId: string): Promise<AdminUserDetail> {
  const result = await apiClient.patch<{ data: AdminUserDetail }>(
    `/api/admin/users/${userId}`,
    { action: 'suspend' }
  )
  return result.data
}

export async function unsuspendAdminUser(userId: string): Promise<AdminUserDetail> {
  const result = await apiClient.patch<{ data: AdminUserDetail }>(
    `/api/admin/users/${userId}`,
    { action: 'unsuspend' }
  )
  return result.data
}

export async function deleteAdminUser(userId: string): Promise<{ deleted: boolean; id: string }> {
  return apiClient.delete<{ deleted: boolean; id: string }>(
    `/api/admin/users/${userId}`
  )
}
