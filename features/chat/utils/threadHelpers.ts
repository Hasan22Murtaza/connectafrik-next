import type { ChatThread } from '@/features/chat/services/supabaseMessagingService'
import type { ChatParticipant } from '@/shared/types/chat'

export function isDirectBlockableThread(
  thread: Pick<ChatThread, 'type' | 'group_id' | 'participants'> | undefined,
  currentUserId: string | undefined
): boolean {
  if (!thread || !currentUserId) return false
  const isGroup =
    thread.type === 'group' ||
    Boolean(thread.group_id) ||
    thread.participants.filter((p: ChatParticipant) => p.id !== currentUserId).length > 1
  if (isGroup) return false
  const others = thread.participants.filter((p: ChatParticipant) => p.id !== currentUserId)
  if (others.length !== 1) return false
  return others[0]?.id !== currentUserId
}

export function isThreadMessagingBlocked(
  thread: Pick<ChatThread, 'is_block' | 'blocked_by_other'> | undefined
): boolean {
  if (!thread) return false
  return Boolean(thread.is_block || thread.blocked_by_other)
}

/**
 * Marketplace conversations live in the Marketplace Inbox, not the general
 * Chats list. Detect them by thread type or the linked listing so they can be
 * excluded from general chat surfaces (sidebar, dropdown).
 */
export function isMarketplaceThread(
  thread: Pick<ChatThread, 'type' | 'product_id' | 'seller_id'> | undefined
): boolean {
  if (!thread) return false
  return (
    thread.type === 'marketplace' ||
    Boolean(thread.product_id) ||
    Boolean(thread.seller_id)
  )
}
