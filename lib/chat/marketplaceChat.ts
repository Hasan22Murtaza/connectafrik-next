import type { SupabaseClient } from '@supabase/supabase-js'

export const MARKETPLACE_INQUIRY = 'marketplace_inquiry'
export const MARKETPLACE_SYSTEM = 'marketplace_system'

export const DEFAULT_INQUIRY_MESSAGE = 'Is this still available? 🙂'

export function isMarketplaceMessageType(t: string | undefined): boolean {
  return t === MARKETPLACE_INQUIRY || t === MARKETPLACE_SYSTEM
}

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
