import type { ChatThread } from '@/features/chat/services/supabaseMessagingService'

export function buildMarketplaceSeedThread(params: {
  threadId: string
  productId: string
  productTitle: string
  productImage: string | null
  sellerId: string
  sellerName: string
  sellerAvatarUrl?: string | null
  buyerId: string
  buyerName: string
  buyerAvatarUrl?: string | null
}): ChatThread {
  const now = new Date().toISOString()

  return {
    id: params.threadId,
    name: params.sellerName,
    type: 'marketplace',
    participants: [
      {
        id: params.sellerId,
        name: params.sellerName,
        avatarUrl: params.sellerAvatarUrl ?? undefined,
      },
      {
        id: params.buyerId,
        name: params.buyerName,
        avatarUrl: params.buyerAvatarUrl ?? undefined,
      },
    ],
    last_message_preview: null,
    last_message_at: now,
    unread_count: 0,
    created_at: now,
    updated_at: now,
    product_id: params.productId,
    product_title: params.productTitle,
    product_image: params.productImage,
    seller_id: params.sellerId,
  }
}
