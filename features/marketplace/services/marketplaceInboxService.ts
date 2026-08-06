import { apiClient } from '@/lib/api-client'

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
  }>('/api/marketplace/threads', {
    product_id: productId,
    message,
  })
  return res.data
}
