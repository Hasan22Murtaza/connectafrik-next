import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  DEFAULT_INQUIRY_MESSAGE,
  MARKETPLACE_INQUIRY,
  findMarketplaceThreadForProduct,
  findOrCreateMarketplaceThread,
  insertMarketplaceMessage,
  insertWaitingForResponseSystemMessage,
} from '@/lib/marketplaceChat'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()

    const productId = typeof body.product_id === 'string' ? body.product_id.trim() : ''
    const message =
      typeof body.message === 'string' && body.message.trim().length > 0
        ? body.message.trim()
        : DEFAULT_INQUIRY_MESSAGE
    const sendInquiry = body.send_inquiry !== false

    if (!productId) {
      return errorResponse('product_id is required', 400)
    }

    const { data: product, error: productError } = await serviceClient
      .from('products')
      .select('id, title, seller_id, is_available, images')
      .eq('id', productId)
      .maybeSingle()

    if (productError) return errorResponse(productError.message, 400)
    if (!product) return errorResponse('Product not found', 404)

    if (product.seller_id === user.id) {
      return errorResponse('You cannot message yourself about your own listing', 400)
    }

    let seller: {
      id: string
      username?: string | null
      full_name?: string | null
      avatar_url?: string | null
    } | null = null

    if (product.seller_id) {
      const { data: sellerRow } = await serviceClient
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .eq('id', product.seller_id)
        .maybeSingle()
      seller = sellerRow
    }

    const buyerName =
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      user.email?.split('@')[0] ||
      'Buyer'

    const existingThreadId = await findMarketplaceThreadForProduct(
      serviceClient,
      product.id,
      user.id,
      product.seller_id
    )
    const isNewThread = !existingThreadId

    const threadId = await findOrCreateMarketplaceThread(serviceClient, {
      productId: product.id,
      buyerId: user.id,
      sellerId: product.seller_id,
      productTitle: product.title,
    })

    let messageId: string | null = null
    if (sendInquiry && isNewThread) {
      const { id } = await insertMarketplaceMessage(serviceClient, {
        threadId,
        senderId: user.id,
        content: message,
        messageType: MARKETPLACE_INQUIRY,
        metadata: {
          product_id: product.id,
          product_title: product.title,
        },
      })
      messageId = id

      await insertWaitingForResponseSystemMessage(
        serviceClient,
        threadId,
        user.id,
        buyerName
      )
    }

    const sellerPayload = seller
      ? {
          id: seller.id,
          full_name: seller.full_name ?? seller.username ?? 'Seller',
          username: seller.username ?? null,
          avatar_url: seller.avatar_url ?? null,
        }
      : null

    return jsonResponse(
      {
        data: {
          thread_id: threadId,
          message_id: messageId,
          is_new_thread: isNewThread,
          product_id: product.id,
          product_title: product.title,
          product_image: Array.isArray(product.images) ? product.images[0] ?? null : null,
          seller_id: product.seller_id,
          seller: sellerPayload,
        },
      },
      201
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to start marketplace conversation'
    if (msg === 'Unauthorized' || msg === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('POST /api/marketplace/inbox/threads error:', err)
    return errorResponse(msg, 500)
  }
}
