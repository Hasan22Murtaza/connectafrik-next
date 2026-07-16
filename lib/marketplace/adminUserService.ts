import { SupabaseClient, User as AuthUser } from '@supabase/supabase-js'

export type AdminUserAccountType = 'buyer' | 'seller' | 'both' | 'none'
export type AdminUserAccountStatus = 'active' | 'suspended'
export type AdminUserFilter =
  | 'all'
  | 'sellers'
  | 'buyers'
  | 'verified'
  | 'unverified'
  | 'active'
  | 'suspended'
  | 'new'

export type AdminUserSortField = 'created_at' | 'full_name' | 'username' | 'last_login'

export interface AdminUserStats {
  total_users: number
  total_buyers: number
  total_sellers: number
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
  account_type: AdminUserAccountType
  is_verified: boolean
  created_at: string
  last_login: string | null
  account_status: AdminUserAccountStatus
  listings_count: number
}

export interface AdminUserSellerStats {
  total_listings: number
  active_listings: number
  sold_items: number
  average_rating: number | null
  total_earnings: number | null
}

export interface AdminUserDetail extends AdminUserListItem {
  phone_number: string | null
  country: string | null
  city: string | null
  address: string | null
  state: string | null
  bio: string | null
  platform_role: string
  seller_tier: string | null
  last_active_at: string | null
  last_seen: string | null
  total_orders: number
  total_reviews: number
  total_transactions: number
  seller_stats: AdminUserSellerStats | null
}

/** Columns required for list + filter + sort — avoid optional/missing profile fields. */
const PROFILE_LIST_COLUMNS =
  'id, username, full_name, avatar_url, is_verified, created_at, last_seen, last_active_at'

const ACTIVE_WINDOW_DAYS = 30
import { COMPLETED_ORDER_STATUSES } from '@/lib/marketplace/orderStatus'

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function getBannedUntil(user: AuthUser | null): string | null {
  const banned = (user as AuthUser & { banned_until?: string | null })?.banned_until
  return banned ?? null
}

function isAuthUserBanned(user: AuthUser | null): boolean {
  const bannedUntil = getBannedUntil(user)
  if (!bannedUntil) return false
  return new Date(bannedUntil) > new Date()
}

function resolveAccountType(
  userId: string,
  sellerIds: Set<string>,
  buyerIds: Set<string>
): AdminUserAccountType {
  const isSeller = sellerIds.has(userId)
  const isBuyer = buyerIds.has(userId)
  if (isSeller && isBuyer) return 'both'
  if (isSeller) return 'seller'
  if (isBuyer) return 'buyer'
  return 'none'
}

async function getDistinctColumnValues(
  serviceClient: SupabaseClient,
  table: string,
  column: string
): Promise<string[]> {
  const { data, error } = await serviceClient.from(table).select(column).not(column, 'is', null)
  if (error) throw new Error(error.message)
  return [
    ...new Set(
      (data ?? []).map((row) => String((row as unknown as Record<string, unknown>)[column]))
    ),
  ]
}

async function getSellerAndBuyerIdSets(serviceClient: SupabaseClient) {
  const [productSellerIds, orderSellerIds, orderBuyerIds] = await Promise.all([
    getDistinctColumnValues(serviceClient, 'products', 'seller_id'),
    getDistinctColumnValues(serviceClient, 'orders', 'seller_id'),
    getDistinctColumnValues(serviceClient, 'orders', 'buyer_id'),
  ])

  const sellerIds = new Set([...productSellerIds, ...orderSellerIds])
  const buyerIds = new Set(orderBuyerIds)
  return { sellerIds, buyerIds }
}

async function getAuthUserSafe(
  serviceClient: SupabaseClient,
  userId: string
): Promise<AuthUser | null> {
  const { data, error } = await serviceClient.auth.admin.getUserById(userId)
  if (error || !data.user) return null
  return data.user
}

async function findAuthUserByEmail(
  serviceClient: SupabaseClient,
  email: string
): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 200

  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)

    const match = data.users.find((user) => user.email?.toLowerCase() === normalized)
    if (match) return match

    if (data.users.length < perPage) break
    page += 1
  }

  return null
}

async function getSuspendedUserIds(serviceClient: SupabaseClient): Promise<string[]> {
  const suspended: string[] = []
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)

    for (const user of data.users) {
      if (isAuthUserBanned(user)) suspended.push(user.id)
    }

    if (data.users.length < perPage) break
    page += 1
    if (page > 50) break
  }

  return suspended
}

async function getListingsCounts(
  serviceClient: SupabaseClient,
  sellerIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (sellerIds.length === 0) return counts

  const { data, error } = await serviceClient
    .from('products')
    .select('seller_id')
    .in('seller_id', sellerIds)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const id = row.seller_id as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return counts
}

async function enrichUserRows(
  serviceClient: SupabaseClient,
  profiles: Array<Record<string, unknown>>,
  sellerIds: Set<string>,
  buyerIds: Set<string>
): Promise<AdminUserListItem[]> {
  const pageSellerIds = profiles
    .map((p) => String(p.id))
    .filter((id) => sellerIds.has(id))

  const listingsCounts = await getListingsCounts(serviceClient, pageSellerIds)

  return Promise.all(
    profiles.map(async (profile) => {
      const id = String(profile.id)
      const authUser = await getAuthUserSafe(serviceClient, id)

      return {
        id,
        username: String(profile.username ?? ''),
        full_name: String(profile.full_name ?? ''),
        avatar_url: (profile.avatar_url as string | null) ?? null,
        email: authUser?.email ?? null,
        account_type: resolveAccountType(id, sellerIds, buyerIds),
        is_verified: Boolean(profile.is_verified),
        created_at: String(profile.created_at),
        last_login:
          (profile.last_active_at as string | null) ??
          (profile.last_seen as string | null) ??
          authUser?.last_sign_in_at ??
          null,
        account_status: isAuthUserBanned(authUser) ? 'suspended' : 'active',
        listings_count: listingsCounts.get(id) ?? 0,
      }
    })
  )
}

export async function getAdminUserStats(serviceClient: SupabaseClient): Promise<AdminUserStats> {
  const todayStart = startOfToday()
  const weekStart = daysAgo(7)
  const activeSince = daysAgo(ACTIVE_WINDOW_DAYS)

  const [
    totalUsersResult,
    newTodayResult,
    newWeekResult,
    activeUsersResult,
    verifiedUsersResult,
    { sellerIds, buyerIds },
  ] = await Promise.all([
    serviceClient.from('profiles').select('id', { count: 'exact', head: true }),
    serviceClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart),
    serviceClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart),
    serviceClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or(`last_active_at.gte.${activeSince},last_seen.gte.${activeSince}`),
    serviceClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_verified', true),
    getSellerAndBuyerIdSets(serviceClient),
  ])

  if (totalUsersResult.error) throw new Error(totalUsersResult.error.message)
  if (newTodayResult.error) throw new Error(newTodayResult.error.message)
  if (newWeekResult.error) throw new Error(newWeekResult.error.message)
  if (activeUsersResult.error) throw new Error(activeUsersResult.error.message)
  if (verifiedUsersResult.error) throw new Error(verifiedUsersResult.error.message)

  return {
    total_users: totalUsersResult.count ?? 0,
    total_buyers: buyerIds.size,
    total_sellers: sellerIds.size,
    new_users_today: newTodayResult.count ?? 0,
    new_users_this_week: newWeekResult.count ?? 0,
    active_users: activeUsersResult.count ?? 0,
    verified_users: verifiedUsersResult.count ?? 0,
  }
}

export async function listAdminUsers(
  serviceClient: SupabaseClient,
  filters: {
    filter?: AdminUserFilter
    search?: string
    sort_by?: AdminUserSortField
    sort_dir?: 'asc' | 'desc'
    page?: number
    limit?: number
  }
) {
  const page = filters.page ?? 0
  const limit = Math.min(filters.limit ?? 20, 100)
  const from = page * limit
  const to = from + limit - 1
  const filter = filters.filter ?? 'all'
  const sortBy = filters.sort_by ?? 'created_at'
  const sortDir = filters.sort_dir ?? 'desc'
  const search = filters.search?.trim()

  const { sellerIds, buyerIds } = await getSellerAndBuyerIdSets(serviceClient)

  if (search?.includes('@')) {
    const authUser = await findAuthUserByEmail(serviceClient, search)
    if (!authUser) {
      return { data: [], count: 0, page, limit }
    }

    const { data: profile, error } = await serviceClient
      .from('profiles')
      .select(PROFILE_LIST_COLUMNS)
      .eq('id', authUser.id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!profile) return { data: [], count: 0, page, limit }

    const enriched = await enrichUserRows(serviceClient, [profile], sellerIds, buyerIds)
    const row = enriched[0]
    if (
      !matchesFilter(row, filter, daysAgo(7), daysAgo(ACTIVE_WINDOW_DAYS))
    ) {
      return { data: [], count: 0, page, limit }
    }

    return { data: enriched, count: 1, page, limit }
  }

  let query = serviceClient
    .from('profiles')
    .select(PROFILE_LIST_COLUMNS, { count: 'exact' })

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%`)
  }

  const weekStart = daysAgo(7)
  const activeSince = daysAgo(ACTIVE_WINDOW_DAYS)

  switch (filter) {
    case 'sellers':
      if (sellerIds.size === 0) return { data: [], count: 0, page, limit }
      query = query.in('id', [...sellerIds])
      break
    case 'buyers':
      if (buyerIds.size === 0) return { data: [], count: 0, page, limit }
      query = query.in('id', [...buyerIds])
      break
    case 'verified':
      query = query.eq('is_verified', true)
      break
    case 'unverified':
      query = query.or('is_verified.is.null,is_verified.eq.false')
      break
    case 'active':
      query = query.or(`last_active_at.gte.${activeSince},last_seen.gte.${activeSince}`)
      break
    case 'new':
      query = query.gte('created_at', weekStart)
      break
    case 'suspended': {
      const suspendedIds = await getSuspendedUserIds(serviceClient)
      if (suspendedIds.length === 0) return { data: [], count: 0, page, limit }
      query = query.in('id', suspendedIds)
      break
    }
    default:
      break
  }

  const sortColumn =
    sortBy === 'last_login'
      ? 'last_active_at'
      : sortBy === 'full_name'
        ? 'full_name'
        : sortBy === 'username'
          ? 'username'
          : 'created_at'

  query = query.order(sortColumn, { ascending: sortDir === 'asc', nullsFirst: false }).range(from, to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const enriched = await enrichUserRows(serviceClient, data ?? [], sellerIds, buyerIds)

  return { data: enriched, count: count ?? 0, page, limit }
}

function matchesFilter(
  user: AdminUserListItem,
  filter: AdminUserFilter,
  weekStart: string,
  activeSince: string
): boolean {
  switch (filter) {
    case 'sellers':
      return user.account_type === 'seller' || user.account_type === 'both'
    case 'buyers':
      return user.account_type === 'buyer' || user.account_type === 'both'
    case 'verified':
      return user.is_verified
    case 'unverified':
      return !user.is_verified
    case 'active':
      return Boolean(
        user.last_login && new Date(user.last_login) >= new Date(activeSince)
      )
    case 'suspended':
      return user.account_status === 'suspended'
    case 'new':
      return new Date(user.created_at) >= new Date(weekStart)
    default:
      return true
  }
}

async function getSellerStats(
  serviceClient: SupabaseClient,
  userId: string
): Promise<AdminUserSellerStats> {
  const [listingsResult, activeListingsResult, soldResult, payoutsResult, sellerProductsResult] =
    await Promise.all([
      serviceClient
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId),
      serviceClient
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .eq('is_available', true),
      serviceClient
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .in('status', COMPLETED_ORDER_STATUSES),
      serviceClient
        .from('seller_payouts')
        .select('amount')
        .eq('seller_id', userId)
        .eq('status', 'completed'),
      serviceClient.from('products').select('id').eq('seller_id', userId),
    ])

  if (listingsResult.error) throw new Error(listingsResult.error.message)
  if (activeListingsResult.error) throw new Error(activeListingsResult.error.message)
  if (soldResult.error) throw new Error(soldResult.error.message)

  let averageRating: number | null = null
  const productIds = (sellerProductsResult.data ?? []).map((p) => p.id as string)
  if (productIds.length > 0) {
    const { data: reviewsData, error: reviewsError } = await serviceClient
      .from('product_reviews')
      .select('rating')
      .in('product_id', productIds)

    if (!reviewsError && reviewsData?.length) {
      const ratings = reviewsData.map((r) => Number(r.rating)).filter((n) => !Number.isNaN(n))
      if (ratings.length > 0) {
        averageRating = ratings.reduce((sum, n) => sum + n, 0) / ratings.length
      }
    }
  }

  let totalEarnings: number | null = null
  if (!payoutsResult.error && payoutsResult.data) {
    totalEarnings = payoutsResult.data.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
  }

  return {
    total_listings: listingsResult.count ?? 0,
    active_listings: activeListingsResult.count ?? 0,
    sold_items: soldResult.count ?? 0,
    average_rating: averageRating,
    total_earnings: totalEarnings,
  }
}

export async function getAdminUserDetail(serviceClient: SupabaseClient, userId: string) {
  const { data: profile, error } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') throw new Error('User not found')
    throw new Error(error.message)
  }

  const { sellerIds, buyerIds } = await getSellerAndBuyerIdSets(serviceClient)
  const authUser = await getAuthUserSafe(serviceClient, userId)
  const accountType = resolveAccountType(userId, sellerIds, buyerIds)
  const isSeller = accountType === 'seller' || accountType === 'both'

  const [buyerOrdersResult, sellerOrdersResult, reviewsWrittenResult, sellerStats] =
    await Promise.all([
      serviceClient
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_id', userId),
      serviceClient
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId),
      serviceClient
        .from('product_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      isSeller ? getSellerStats(serviceClient, userId) : Promise.resolve(null),
    ])

  if (buyerOrdersResult.error) throw new Error(buyerOrdersResult.error.message)
  if (sellerOrdersResult.error) throw new Error(sellerOrdersResult.error.message)

  let reviewsReceivedCount = 0
  if (isSeller) {
    const { data: sellerProducts } = await serviceClient
      .from('products')
      .select('id')
      .eq('seller_id', userId)

    const productIds = (sellerProducts ?? []).map((p) => p.id as string)
    if (productIds.length > 0) {
      const { count, error: reviewsError } = await serviceClient
        .from('product_reviews')
        .select('id', { count: 'exact', head: true })
        .in('product_id', productIds)

      if (!reviewsError) reviewsReceivedCount = count ?? 0
    }
  }

  const totalOrders = (buyerOrdersResult.count ?? 0) + (sellerOrdersResult.count ?? 0)
  const totalReviews = (reviewsWrittenResult.count ?? 0) + reviewsReceivedCount

  const listingsCounts = isSeller
    ? await getListingsCounts(serviceClient, [userId])
    : new Map<string, number>()

  const detail: AdminUserDetail = {
    id: userId,
    username: String(profile.username ?? ''),
    full_name: String(profile.full_name ?? ''),
    avatar_url: profile.avatar_url ?? null,
    email: authUser?.email ?? null,
    phone_number: profile.phone_number ?? null,
    country: profile.country ?? null,
    city: profile.city ?? null,
    address: profile.address ?? null,
    state: profile.state ?? null,
    bio: profile.bio ?? null,
    platform_role: String(profile.platform_role ?? 'user'),
    seller_tier: profile.seller_tier ?? null,
    account_type: accountType,
    is_verified: Boolean(profile.is_verified),
    created_at: String(profile.created_at),
    last_login:
      profile.last_active_at ?? profile.last_seen ?? authUser?.last_sign_in_at ?? null,
    last_active_at: profile.last_active_at ?? null,
    last_seen: profile.last_seen ?? null,
    account_status: isAuthUserBanned(authUser) ? 'suspended' : 'active',
    listings_count: listingsCounts.get(userId) ?? 0,
    total_orders: totalOrders,
    total_reviews: totalReviews,
    total_transactions: totalOrders,
    seller_stats: sellerStats,
  }

  return detail
}

function getBootstrapAdminIds(): string[] {
  return (
    process.env.MARKETPLACE_ADMIN_USER_IDS?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? []
  )
}

async function assertCanManageUser(
  serviceClient: SupabaseClient,
  targetUserId: string,
  actingAdminId: string
) {
  if (targetUserId === actingAdminId) {
    throw new Error('Cannot manage your own account')
  }

  if (getBootstrapAdminIds().includes(targetUserId)) {
    throw new Error('Cannot manage a bootstrap admin account')
  }

  const { data: profile, error } = await serviceClient
    .from('profiles')
    .select('platform_role')
    .eq('id', targetUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') throw new Error('User not found')
    throw new Error(error.message)
  }

  const role = String(profile.platform_role ?? 'user')
  if (role === 'admin' || role === 'super_admin') {
    throw new Error('Cannot manage admin accounts')
  }
}

/** Indefinite ban via Supabase Auth (admin can unban later). */
const SUSPEND_BAN_DURATION = '876000h'

export async function suspendAdminUser(
  serviceClient: SupabaseClient,
  targetUserId: string,
  actingAdminId: string
) {
  await assertCanManageUser(serviceClient, targetUserId, actingAdminId)

  const { error } = await serviceClient.auth.admin.updateUserById(targetUserId, {
    ban_duration: SUSPEND_BAN_DURATION,
  })

  if (error) throw new Error(error.message)
  return getAdminUserDetail(serviceClient, targetUserId)
}

export async function unsuspendAdminUser(
  serviceClient: SupabaseClient,
  targetUserId: string,
  actingAdminId: string
) {
  await assertCanManageUser(serviceClient, targetUserId, actingAdminId)

  const { error } = await serviceClient.auth.admin.updateUserById(targetUserId, {
    ban_duration: 'none',
  })

  if (error) throw new Error(error.message)
  return getAdminUserDetail(serviceClient, targetUserId)
}

export async function deleteAdminUser(
  serviceClient: SupabaseClient,
  targetUserId: string,
  actingAdminId: string
) {
  await assertCanManageUser(serviceClient, targetUserId, actingAdminId)

  const { error } = await serviceClient.auth.admin.deleteUser(targetUserId)
  if (error) throw new Error(error.message)

  return { deleted: true as const, id: targetUserId }
}
