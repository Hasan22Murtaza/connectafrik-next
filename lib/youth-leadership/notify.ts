import { createNotification } from '@/lib/notifications/createNotification'
import type { NotificationType } from '@/shared/types/notifications'

export async function notifyYouthUser(input: {
  user_id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
}) {
  return createNotification({
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    message: input.message,
    data: {
      ...(input.data || {}),
      href: typeof input.data?.href === 'string' ? input.data.href : '/youth-leadership',
    },
  })
}
