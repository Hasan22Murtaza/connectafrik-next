import { apiClient } from '@/lib/api-client'

export interface MarketplaceInboxItem {
  thread_id: string
  product_id: string
  product_title: string
  product_image: string | null
  product_available: boolean
  counterparty: {
    id: string
    full_name: string
    username: string | null
    avatar_url: string | null
  } | null
  last_message_preview: string
  last_message_at: string
  unread_count: number
  order_status: string | null
  payment_status: string | null
  inbox_label: string | null
  order_id: string | null
  display_title: string
}

export async function fetchMarketplaceInbox(params: {
  role: 'selling' | 'buying'
  label?: string
}): Promise<MarketplaceInboxItem[]> {
  const res = await apiClient.get<{ data: MarketplaceInboxItem[] }>('/api/marketplace/inbox', {
    role: params.role,
    label: params.label || 'all',
  })
  return res.data || []
}

export async function startMarketplaceConversation(
  productId: string,
  message?: string
): Promise<{
  thread_id: string
  message_id: string | null
  is_new_thread: boolean
  product_id: string
  product_title: string
  product_image: string | null
  seller_id: string
  seller: {
    id: string
    full_name: string
    username: string | null
    avatar_url: string | null
  } | null
}> {
  const res = await apiClient.post<{
    data: {
      thread_id: string
      message_id: string | null
      is_new_thread: boolean
      product_id: string
      product_title: string
      product_image: string | null
      seller_id: string
      seller: {
        id: string
        full_name: string
        username: string | null
        avatar_url: string | null
      } | null
    }
  }>('/api/marketplace/inbox/threads', {
    product_id: productId,
    message,
  })
  return res.data
}
