import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications/createNotification'
import type { NotificationType } from '@/shared/types/notifications'

/** Notify active owner/admin members of an organization (best-effort). */
export async function notifyGschOrgOwners(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    type: NotificationType
    title: string
    message: string
    data?: Record<string, unknown>
    excludeUserId?: string
  }
) {
  const { data: members } = await supabase
    .from('gsch_memberships')
    .select('user_id, role')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin', 'representative'])

  const recipients = (members || [])
    .map((m) => m.user_id)
    .filter((id) => id && id !== input.excludeUserId)

  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        user_id: userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
      }).catch(() => null)
    )
  )
}
