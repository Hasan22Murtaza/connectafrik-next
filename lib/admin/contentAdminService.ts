import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminContentFilter = 'all' | 'active' | 'removed' | 'unavailable'

export interface AdminProfileRef {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

export interface AdminPostRow {
  id: string
  content: string | null
  author_id: string | null
  media_type: string | null
  is_deleted: boolean
  created_at: string
  author: AdminProfileRef | null
}

export interface AdminReelRow {
  id: string
  title: string | null
  description: string | null
  author_id: string | null
  is_deleted: boolean
  created_at: string
  author: AdminProfileRef | null
}

export interface AdminListingRow {
  id: string
  title: string | null
  seller_id: string | null
  price: number | null
  currency: string | null
  is_available: boolean
  created_at: string
  seller: AdminProfileRef | null
}

export interface AdminCallRow {
  id: string
  call_id: string | null
  created_by: string | null
  call_type: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  participant_count: number
  initiator: AdminProfileRef | null
}

export interface AdminPlatformSettingRow {
  key: string
  value: number
  source: 'database' | 'default'
}

export interface PaginatedAdminList<T> {
  data: T[]
  count: number
  page: number
  limit: number
}

const PLATFORM_SETTING_DEFAULTS: Record<string, number> = {
  default_commission_rate: 0.05,
  new_seller_hold_days: 7,
  standard_seller_hold_days: 3,
  trusted_seller_hold_days: 1,
  new_seller_order_threshold: 10,
  trusted_seller_order_threshold: 50,
  auto_release_after_ship_days: 14,
  dispute_buyer_window_days: 30,
}

function clampLimit(limit: number) {
  return Math.min(Math.max(limit || 20, 1), 100)
}

function clampPage(page: number) {
  return Math.max(page || 0, 0)
}

async function loadProfiles(
  client: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Map<string, AdminProfileRef>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  const map = new Map<string, AdminProfileRef>()
  if (unique.length === 0) return map

  const { data } = await client
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', unique)

  for (const row of data || []) {
    map.set(row.id, {
      id: row.id,
      username: row.username ?? null,
      full_name: row.full_name ?? null,
      avatar_url: row.avatar_url ?? null,
    })
  }
  return map
}

export async function listAdminPosts(
  client: SupabaseClient,
  options: {
    page?: number
    limit?: number
    search?: string
    filter?: AdminContentFilter
  } = {}
): Promise<PaginatedAdminList<AdminPostRow>> {
  const page = clampPage(options.page ?? 0)
  const limit = clampLimit(options.limit ?? 20)
  const from = page * limit
  const to = from + limit - 1

  let query = client
    .from('posts')
    .select('id, content, author_id, media_type, is_deleted, created_at', {
      count: 'exact',
    })

  if (options.filter === 'active') query = query.eq('is_deleted', false)
  if (options.filter === 'removed') query = query.eq('is_deleted', true)
  if (options.search?.trim()) {
    const q = options.search.trim()
    query = query.or(`content.ilike.%${q}%,id.eq.${q}`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const profiles = await loadProfiles(
    client,
    (data || []).map((row) => row.author_id)
  )

  return {
    data: (data || []).map((row) => ({
      id: row.id,
      content: row.content ?? null,
      author_id: row.author_id ?? null,
      media_type: row.media_type ?? null,
      is_deleted: Boolean(row.is_deleted),
      created_at: row.created_at,
      author: row.author_id ? profiles.get(row.author_id) || null : null,
    })),
    count: count ?? 0,
    page,
    limit,
  }
}

export async function getAdminPostsStats(client: SupabaseClient) {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [total, active, removed, week] = await Promise.all([
    client.from('posts').select('id', { count: 'exact', head: true }),
    client
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false),
    client
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', true),
    client
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since7d)
      .eq('is_deleted', false),
  ])

  return {
    total: total.count ?? 0,
    active: active.count ?? 0,
    removed: removed.count ?? 0,
    last_7_days: week.count ?? 0,
  }
}

export async function listAdminReels(
  client: SupabaseClient,
  options: {
    page?: number
    limit?: number
    search?: string
    filter?: AdminContentFilter
  } = {}
): Promise<PaginatedAdminList<AdminReelRow>> {
  const page = clampPage(options.page ?? 0)
  const limit = clampLimit(options.limit ?? 20)
  const from = page * limit
  const to = from + limit - 1

  let query = client
    .from('reels')
    .select('id, title, description, author_id, is_deleted, created_at', {
      count: 'exact',
    })

  if (options.filter === 'active') query = query.eq('is_deleted', false)
  if (options.filter === 'removed') query = query.eq('is_deleted', true)
  if (options.search?.trim()) {
    const q = options.search.trim()
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,id.eq.${q}`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const profiles = await loadProfiles(
    client,
    (data || []).map((row) => row.author_id)
  )

  return {
    data: (data || []).map((row) => ({
      id: row.id,
      title: row.title ?? null,
      description: row.description ?? null,
      author_id: row.author_id ?? null,
      is_deleted: Boolean(row.is_deleted),
      created_at: row.created_at,
      author: row.author_id ? profiles.get(row.author_id) || null : null,
    })),
    count: count ?? 0,
    page,
    limit,
  }
}

export async function getAdminReelsStats(client: SupabaseClient) {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [total, active, removed, week] = await Promise.all([
    client.from('reels').select('id', { count: 'exact', head: true }),
    client
      .from('reels')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false),
    client
      .from('reels')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', true),
    client
      .from('reels')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since7d)
      .eq('is_deleted', false),
  ])

  return {
    total: total.count ?? 0,
    active: active.count ?? 0,
    removed: removed.count ?? 0,
    last_7_days: week.count ?? 0,
  }
}

export async function listAdminListings(
  client: SupabaseClient,
  options: {
    page?: number
    limit?: number
    search?: string
    filter?: AdminContentFilter
  } = {}
): Promise<PaginatedAdminList<AdminListingRow>> {
  const page = clampPage(options.page ?? 0)
  const limit = clampLimit(options.limit ?? 20)
  const from = page * limit
  const to = from + limit - 1

  let query = client
    .from('products')
    .select('id, title, seller_id, price, currency, is_available, created_at', {
      count: 'exact',
    })

  if (options.filter === 'active') query = query.eq('is_available', true)
  if (options.filter === 'unavailable') query = query.eq('is_available', false)
  if (options.search?.trim()) {
    const q = options.search.trim()
    query = query.or(`title.ilike.%${q}%,id.eq.${q}`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const profiles = await loadProfiles(
    client,
    (data || []).map((row) => row.seller_id)
  )

  return {
    data: (data || []).map((row) => ({
      id: row.id,
      title: row.title ?? null,
      seller_id: row.seller_id ?? null,
      price: row.price == null ? null : Number(row.price),
      currency: row.currency ?? null,
      is_available: Boolean(row.is_available),
      created_at: row.created_at,
      seller: row.seller_id ? profiles.get(row.seller_id) || null : null,
    })),
    count: count ?? 0,
    page,
    limit,
  }
}

export async function getAdminListingsStats(client: SupabaseClient) {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [total, available, unavailable, week] = await Promise.all([
    client.from('products').select('id', { count: 'exact', head: true }),
    client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_available', true),
    client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_available', false),
    client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since7d),
  ])

  return {
    total: total.count ?? 0,
    available: available.count ?? 0,
    unavailable: unavailable.count ?? 0,
    last_7_days: week.count ?? 0,
  }
}

export async function listAdminCalls(
  client: SupabaseClient,
  options: {
    page?: number
    limit?: number
    search?: string
    status?: string
  } = {}
): Promise<PaginatedAdminList<AdminCallRow>> {
  const page = clampPage(options.page ?? 0)
  const limit = clampLimit(options.limit ?? 20)
  const from = page * limit
  const to = from + limit - 1

  let query = client
    .from('call_sessions')
    .select(
      'id, call_id, created_by, call_type, status, started_at, ended_at, duration_seconds, participants, created_at',
      { count: 'exact' }
    )

  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }
  if (options.search?.trim()) {
    const q = options.search.trim()
    query = query.or(`call_id.ilike.%${q}%,id.eq.${q}`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const profiles = await loadProfiles(
    client,
    (data || []).map((row) => row.created_by)
  )

  return {
    data: (data || []).map((row) => {
      const participants = Array.isArray(row.participants) ? row.participants : []
      return {
        id: row.id,
        call_id: row.call_id ?? null,
        created_by: row.created_by ?? null,
        call_type: row.call_type ?? null,
        status: row.status ?? null,
        started_at: row.started_at ?? null,
        ended_at: row.ended_at ?? null,
        duration_seconds:
          row.duration_seconds == null ? null : Number(row.duration_seconds),
        participant_count: participants.length,
        initiator: row.created_by ? profiles.get(row.created_by) || null : null,
      }
    }),
    count: count ?? 0,
    page,
    limit,
  }
}

export async function getAdminCallsStats(client: SupabaseClient) {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [total, active, failed, missed, week] = await Promise.all([
    client.from('call_sessions').select('id', { count: 'exact', head: true }),
    client
      .from('call_sessions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ringing', 'initiated', 'active', 'connected']),
    client
      .from('call_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),
    client
      .from('call_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'missed'),
    client
      .from('call_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since7d),
  ])

  return {
    total: total.count ?? 0,
    active: active.count ?? 0,
    failed: failed.count ?? 0,
    missed: missed.count ?? 0,
    last_7_days: week.count ?? 0,
  }
}

export async function listAdminPlatformSettings(
  client: SupabaseClient
): Promise<AdminPlatformSettingRow[]> {
  const { data, error } = await client.from('platform_settings').select('key, value')
  if (error) throw new Error(error.message)

  const dbMap = new Map<string, number>()
  for (const row of data || []) {
    const parsed =
      typeof row.value === 'number' ? row.value : parseFloat(String(row.value))
    if (Number.isFinite(parsed)) dbMap.set(row.key, parsed)
  }

  return Object.keys(PLATFORM_SETTING_DEFAULTS).map((key) => {
    const hasDb = dbMap.has(key)
    return {
      key,
      value: hasDb ? (dbMap.get(key) as number) : PLATFORM_SETTING_DEFAULTS[key],
      source: hasDb ? 'database' : 'default',
    }
  })
}

export async function upsertAdminPlatformSetting(
  client: SupabaseClient,
  key: string,
  value: number
): Promise<AdminPlatformSettingRow> {
  if (!(key in PLATFORM_SETTING_DEFAULTS)) {
    throw new Error('Unknown platform setting key')
  }
  if (!Number.isFinite(value)) {
    throw new Error('Setting value must be a number')
  }

  const { error } = await client.from('platform_settings').upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )

  if (error) throw new Error(error.message)

  return { key, value, source: 'database' }
}

export { PLATFORM_SETTING_DEFAULTS }
