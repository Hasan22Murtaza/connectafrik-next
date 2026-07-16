import type { SupabaseClient } from '@supabase/supabase-js'

export const MARKETPLACE_INQUIRY = 'marketplace_inquiry'
export const MARKETPLACE_SYSTEM = 'marketplace_system'

export const DEFAULT_INQUIRY_MESSAGE = 'Is this still available? 🙂'

import {
  MARKETPLACE_INBOX_LABELS,
  orderMatchesInboxLabel,
  resolveOrderInboxLabel,
  type MarketplaceInboxLabel,
  type MarketplaceInboxRole,
} from '@/lib/marketplace/orderStatus'

export {
  MARKETPLACE_INBOX_LABELS,
  orderMatchesInboxLabel,
  resolveOrderInboxLabel,
  type MarketplaceInboxLabel,
  type MarketplaceInboxRole,
} from '@/lib/marketplace/orderStatus'

export function isMarketplaceMessageType(t: string | undefined): boolean {
  return t === MARKETPLACE_INQUIRY || t === MARKETPLACE_SYSTEM
}

type OrderRow = {
  id: string
  status: string
  payment_status: string
  payment_method: string | null
  product_id: string
  buyer_id: string
  seller_id: string
  created_at: string
}

const THREAD_SELECT = `
  id,
  type,
  product_id,
  seller_id,
  last_message_preview,
  last_message_at,
  last_activity_at,
  created_at,
  updated_at,
  product:products!chat_threads_product_id_fkey(
    id,
    title,
    images,
    seller_id,
    is_available
  ),
  chat_participants(
    user_id,
    unread_count,
    user:profiles!user_id(id, username, full_name, avatar_url)
  )
`

export async function findMarketplaceThreadForProduct(
  serviceClient: SupabaseClient,
  productId: string,
  buyerId: string,
  sellerId: string
): Promise<string | null> {
  const { data: threads, error } = await serviceClient
    .from('chat_threads')
    .select('id, chat_participants(user_id)')
    .eq('type', 'marketplace')
    .eq('product_id', productId)

  if (error) throw error
  if (!threads?.length) return null

  const wanted = new Set([buyerId, sellerId])
  for (const thread of threads as { id: string; chat_participants?: { user_id: string }[] }[]) {
    const ids = new Set((thread.chat_participants ?? []).map((p) => p.user_id))
    if (ids.size === wanted.size && [...wanted].every((id) => ids.has(id))) {
      return thread.id
    }
  }

  return null
}

export async function findOrCreateMarketplaceThread(
  serviceClient: SupabaseClient,
  params: {
    productId: string
    buyerId: string
    sellerId: string
    productTitle: string
  }
): Promise<string> {
  const existingId = await findMarketplaceThreadForProduct(
    serviceClient,
    params.productId,
    params.buyerId,
    params.sellerId
  )
  if (existingId) return existingId

  const { data: thread, error: threadError } = await serviceClient
    .from('chat_threads')
    .insert({
      type: 'marketplace',
      product_id: params.productId,
      seller_id: params.sellerId,
      title: params.productTitle,
      name: params.productTitle,
      created_by: params.buyerId,
    })
    .select('id')
    .single()

  if (threadError || !thread) {
    throw new Error(threadError?.message || 'Failed to create marketplace thread')
  }

  const participants = [params.buyerId, params.sellerId].map((userId) => ({
    thread_id: thread.id,
    user_id: userId,
    role: userId === params.sellerId ? 'admin' : 'member',
  }))

  const { error: partError } = await serviceClient.from('chat_participants').insert(participants)
  if (partError) {
    await serviceClient.from('chat_threads').delete().eq('id', thread.id)
    throw new Error(partError.message)
  }

  return thread.id
}

export async function insertMarketplaceMessage(
  serviceClient: SupabaseClient,
  params: {
    threadId: string
    senderId: string
    content: string
    messageType: typeof MARKETPLACE_INQUIRY | typeof MARKETPLACE_SYSTEM | 'text'
    metadata?: Record<string, unknown>
  }
): Promise<{ id: string }> {
  const now = new Date().toISOString()
  const preview =
    params.content.length > 100 ? `${params.content.slice(0, 97)}...` : params.content

  const { data: message, error } = await serviceClient
    .from('chat_messages')
    .insert({
      thread_id: params.threadId,
      sender_id: params.senderId,
      content: params.content,
      message_type: params.messageType,
      metadata: params.metadata ?? {},
    })
    .select('id')
    .single()

  if (error || !message) {
    throw new Error(error?.message || 'Failed to send message')
  }

  await Promise.all([
    serviceClient.from('message_reads').insert({
      message_id: message.id,
      user_id: params.senderId,
    }),
    serviceClient
      .from('chat_threads')
      .update({
        last_message_preview: preview,
        last_message_at: now,
        last_activity_at: now,
        updated_at: now,
      })
      .eq('id', params.threadId),
    serviceClient.rpc('chat_bump_unread_for_recipients', {
      p_thread_id: params.threadId,
      p_sender_id: params.senderId,
    }),
  ])

  return { id: message.id }
}

export async function fetchMarketplaceInboxThreads(
  serviceClient: SupabaseClient,
  userId: string,
  role: MarketplaceInboxRole,
  label: MarketplaceInboxLabel
) {
  const { data: participantRows, error: partError } = await serviceClient
    .from('chat_participants')
    .select('thread_id, unread_count')
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (partError) throw partError

  const threadIds = (participantRows ?? []).map((r: { thread_id: string }) => r.thread_id)
  if (threadIds.length === 0) return []

  const unreadByThread = new Map<string, number>(
    (participantRows ?? []).map((r: { thread_id: string; unread_count: number }) => [
      r.thread_id,
      typeof r.unread_count === 'number' ? r.unread_count : 0,
    ])
  )

  const { data: threads, error: threadError } = await serviceClient
    .from('chat_threads')
    .select(THREAD_SELECT)
    .in('id', threadIds)
    .eq('type', 'marketplace')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (threadError) throw threadError
  if (!threads?.length) return []

  const roleFiltered = (threads as Record<string, unknown>[]).filter((thread) => {
    const sellerId = thread.seller_id as string | null
    const product = thread.product as { seller_id?: string } | null
    const resolvedSellerId = sellerId || product?.seller_id
    if (role === 'selling') return resolvedSellerId === userId
    return resolvedSellerId !== userId
  })

  if (roleFiltered.length === 0) return []

  const productIds = [
    ...new Set(
      roleFiltered
        .map((t) => t.product_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const counterpartyIds = new Set<string>()
  for (const thread of roleFiltered) {
    const participants = (thread.chat_participants as { user_id: string }[]) ?? []
    for (const p of participants) {
      if (p.user_id !== userId) counterpartyIds.add(p.user_id)
    }
  }

  let ordersByKey = new Map<string, OrderRow>()
  if (productIds.length > 0 && counterpartyIds.size > 0) {
    const { data: orders } = await serviceClient
      .from('orders')
      .select('id, status, payment_status, payment_method, product_id, buyer_id, seller_id, created_at')
      .in('product_id', productIds)
      .order('created_at', { ascending: false })

    for (const order of (orders ?? []) as OrderRow[]) {
      const key = `${order.product_id}:${order.buyer_id}:${order.seller_id}`
      if (!ordersByKey.has(key)) {
        ordersByKey.set(key, order)
      }
    }
  }

  const items = roleFiltered
    .map((thread) => {
      const participants =
        (thread.chat_participants as {
          user_id: string
          user?: { id: string; username?: string; full_name?: string; avatar_url?: string | null }
        }[]) ?? []
      const counterparty = participants.find((p) => p.user_id !== userId)?.user
      const sellerId = (thread.seller_id as string | null) || (thread.product as { seller_id?: string } | null)?.seller_id
      const buyerId = participants.find((p) => p.user_id !== sellerId)?.user_id
      const product = thread.product as {
        id: string
        title: string
        images?: string[]
        seller_id?: string
        is_available?: boolean
      } | null

      const orderKey =
        product?.id && buyerId && sellerId ? `${product.id}:${buyerId}:${sellerId}` : null
      const order = orderKey ? ordersByKey.get(orderKey) ?? null : null
      const resolvedLabel = resolveOrderInboxLabel(order)

      if (!orderMatchesInboxLabel(order, label)) return null

      const counterpartyName =
        counterparty?.full_name?.trim() ||
        counterparty?.username?.trim() ||
        'User'
      const productTitle = product?.title || (thread.title as string) || 'Listing'

      return {
        thread_id: thread.id as string,
        product_id: product?.id ?? (thread.product_id as string),
        product_title: productTitle,
        product_image: product?.images?.[0] ?? null,
        product_available: product?.is_available ?? true,
        counterparty: counterparty
          ? {
              id: counterparty.id,
              full_name: counterparty.full_name ?? counterparty.username ?? 'User',
              username: counterparty.username ?? null,
              avatar_url: counterparty.avatar_url ?? null,
            }
          : null,
        last_message_preview: (thread.last_message_preview as string | null) ?? '',
        last_message_at:
          (thread.last_message_at as string | null) ||
          (thread.last_activity_at as string | null) ||
          (thread.created_at as string),
        unread_count: unreadByThread.get(thread.id as string) ?? 0,
        order_status: order?.status ?? null,
        payment_status: order?.payment_status ?? null,
        inbox_label: resolvedLabel,
        order_id: order?.id ?? null,
        display_title: `${counterpartyName} · ${productTitle}`,
      }
    })
    .filter(Boolean)

  return items as NonNullable<(typeof items)[number]>[]
}

export async function insertWaitingForResponseSystemMessage(
  serviceClient: SupabaseClient,
  threadId: string,
  buyerId: string,
  buyerName: string
): Promise<void> {
  await insertMarketplaceMessage(serviceClient, {
    threadId,
    senderId: buyerId,
    content: `${buyerName} is waiting for your response.`,
    messageType: MARKETPLACE_SYSTEM,
    metadata: { event: 'waiting_for_response' },
  })
}
