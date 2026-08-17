import { createServiceClient } from '@/lib/supabase-server'
import type { NotificationType } from '@/shared/types/notifications'

export async function createNotification(input: {
  user_id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  reactivate?: boolean
}): Promise<string | null> {
  const serviceSupabase = createServiceClient()
  const data: Record<string, unknown> = {
    ...(input.data || {}),
    type: input.type,
  }

  const friendRequestIdValue = data['friend_request_id']
  const friendRequestId =
    input.type === 'friend_request' && typeof friendRequestIdValue === 'string'
      ? friendRequestIdValue.trim()
      : ''

  if (friendRequestId) {
    const { data: existing, error: lookupError } = await serviceSupabase
      .from('notifications')
      .select('id')
      .eq('user_id', input.user_id)
      .filter('data->>friend_request_id', 'eq', friendRequestId)
      .filter('data->>type', 'eq', input.type)
      .limit(1)
      .maybeSingle()

    if (!lookupError && existing?.id) {
      if (input.reactivate) {
        const now = new Date().toISOString()
        await serviceSupabase
          .from('notifications')
          .update({
            is_read: false,
            title: input.title,
            message: input.message,
            data,
            created_at: now,
          })
          .eq('id', existing.id)
      }
      return existing.id
    }
  }

  const row = {
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    message: input.message,
    data,
    is_read: false,
  }

  const { data: inserted, error } = await serviceSupabase
    .from('notifications')
    .insert(row)
    .select('id')
    .single()

  if (!error && inserted?.id) {
    return inserted.id
  }

  console.error('Notification insert failed (same path as posts):', error)

  if (error && input.type !== 'system') {
    const { data: fallback, error: fallbackError } = await serviceSupabase
      .from('notifications')
      .insert({ ...row, type: 'system' })
      .select('id')
      .single()

    if (fallbackError) {
      console.error('Notification insert fallback failed:', fallbackError)
      return null
    }
    return fallback?.id ?? null
  }

  return inserted?.id ?? null
}
