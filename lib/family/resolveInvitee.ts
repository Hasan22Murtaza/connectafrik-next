import type { SupabaseClient, User } from '@supabase/supabase-js'

/** Looks up a user id by email; null if none (email-only invite still allowed). */
export async function findUserIdByEmail(
  serviceClient: SupabaseClient,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return null

  const match = await findAuthUserByEmail(serviceClient, normalized)
  return match?.id ?? null
}

async function findAuthUserByEmail(
  serviceClient: SupabaseClient,
  normalizedEmail: string
): Promise<User | null> {
  let page = 1
  const perPage = 200

  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)

    const match = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail)
    if (match) return match

    if (data.users.length < perPage) break
    page += 1
  }

  return null
}
