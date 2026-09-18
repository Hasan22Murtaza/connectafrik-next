import type { SupabaseClient } from '@supabase/supabase-js'
import { userAllowsNotificationEmail } from '@/lib/notifications/prefs'

export type EmailRecipient = {
  email: string
  name: string
}

function displayName(
  profile: { full_name?: string | null; first_name?: string | null; username?: string | null } | null,
  email: string
): string {
  return (
    profile?.full_name?.trim() ||
    profile?.first_name?.trim() ||
    profile?.username?.trim() ||
    email.split('@')[0] ||
    'there'
  )
}

/** Resolve a user's inbox address and display name via Auth + profiles. */
export async function lookupUserContact(
  serviceClient: SupabaseClient,
  userId: string
): Promise<EmailRecipient | null> {
  const { data, error } = await serviceClient.auth.admin.getUserById(userId)
  const email = data?.user?.email
  if (error || !email?.includes('@')) return null

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('full_name, first_name, username')
    .eq('id', userId)
    .maybeSingle()

  return { email, name: displayName(profile, email) }
}

/**
 * Resolve an inbox for SES notification mail. Returns null when the user
 * disabled Email Notifications (in-app and push are unaffected).
 */
export async function lookupNotificationEmailRecipient(
  serviceClient: SupabaseClient,
  userId: string,
  type?: string | null
): Promise<EmailRecipient | null> {
  if (!(await userAllowsNotificationEmail(userId, type, serviceClient))) return null
  return lookupUserContact(serviceClient, userId)
}

/** Platform admins who should receive moderation / report emails. */
export async function lookupAdminContacts(
  serviceClient: SupabaseClient
): Promise<EmailRecipient[]> {
  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('id, full_name, first_name, username')
    .in('platform_role', ['admin', 'super_admin'])

  const ids = [...new Set((profiles || []).map((row) => row.id).filter(Boolean))]
  const recipients: EmailRecipient[] = []

  await Promise.all(
    ids.map(async (id) => {
      const contact = await lookupUserContact(serviceClient, id)
      if (contact) recipients.push(contact)
    })
  )

  return recipients
}
