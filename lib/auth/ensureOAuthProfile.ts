import type { SupabaseClient, User } from '@supabase/supabase-js'

type OAuthNameParts = {
  firstName: string | null
  lastName: string | null
  fullName: string | null
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Apple may send name only on the first authorization.
 * Supabase typically stores it as `full_name`, `name`, or given/family parts.
 */
export function extractOAuthNameParts(user: User): OAuthNameParts {
  const meta = (user.user_metadata || {}) as Record<string, unknown>

  const nameObject =
    meta.name && typeof meta.name === 'object' && !Array.isArray(meta.name)
      ? (meta.name as Record<string, unknown>)
      : null

  const given =
    asNonEmptyString(meta.given_name) ||
    asNonEmptyString(meta.first_name) ||
    asNonEmptyString(nameObject?.firstName) ||
    asNonEmptyString(nameObject?.givenName)
  const family =
    asNonEmptyString(meta.family_name) ||
    asNonEmptyString(meta.last_name) ||
    asNonEmptyString(nameObject?.lastName) ||
    asNonEmptyString(nameObject?.familyName)

  const fullFromParts = [given, family].filter(Boolean).join(' ').trim() || null
  const fullName =
    asNonEmptyString(meta.full_name) ||
    (typeof meta.name === 'string' ? asNonEmptyString(meta.name) : null) ||
    fullFromParts

  let firstName = given
  let lastName = family

  if (!firstName && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean)
    firstName = parts[0] || null
    lastName = parts.length > 1 ? parts.slice(1).join(' ') : null
  }

  return {
    firstName,
    lastName,
    fullName: fullName || ([firstName, lastName].filter(Boolean).join(' ') || null),
  }
}

function sanitizeUsernameBase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 24)
}

function usernameCandidateFromUser(user: User, name: OAuthNameParts): string {
  const emailLocal = user.email?.split('@')[0] || ''
  const fromEmail = sanitizeUsernameBase(emailLocal)
  if (fromEmail.length >= 3) return fromEmail

  const fromName = sanitizeUsernameBase(
    [name.firstName, name.lastName].filter(Boolean).join('') || name.fullName || ''
  )
  if (fromName.length >= 3) return fromName

  return `user${user.id.replace(/-/g, '').slice(0, 10)}`
}

async function allocateUniqueUsername(
  serviceClient: SupabaseClient,
  base: string
): Promise<string> {
  const normalized = sanitizeUsernameBase(base) || `user${Date.now().toString(36)}`
  const seed = normalized.length >= 3 ? normalized : `user${normalized}`

  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate =
      attempt === 0 ? seed : `${seed.slice(0, 18)}${Math.floor(Math.random() * 9000 + 1000)}`

    const { data } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('username', candidate)
      .maybeSingle()

    if (!data) return candidate
  }

  return `user${Date.now().toString(36)}`
}

function avatarFromUser(user: User): string | null {
  const meta = user.user_metadata || {}
  return (
    asNonEmptyString(meta.avatar_url) ||
    asNonEmptyString(meta.picture) ||
    asNonEmptyString(meta.profile_image)
  )
}

/**
 * Create a CribsTalk profile for a new OAuth user, or backfill empty name/avatar
 * fields on an existing profile without overwriting user-edited data.
 */
export async function ensureOAuthProfile(
  serviceClient: SupabaseClient,
  user: User
): Promise<{ created: boolean; profileId: string }> {
  const { data: existing, error: existingError } = await serviceClient
    .from('profiles')
    .select('id, username, first_name, last_name, full_name, avatar_url, terms_accepted_at')
    .eq('id', user.id)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  const name = extractOAuthNameParts(user)
  const avatarUrl = avatarFromUser(user)
  const now = new Date().toISOString()

  if (existing) {
    const updates: Record<string, string | null> = {}

    if (!asNonEmptyString(existing.first_name) && name.firstName) {
      updates.first_name = name.firstName
    }
    if (!asNonEmptyString(existing.last_name) && name.lastName) {
      updates.last_name = name.lastName
    }
    if (!asNonEmptyString(existing.full_name) && name.fullName) {
      updates.full_name = name.fullName
    }
    if (!asNonEmptyString(existing.avatar_url) && avatarUrl) {
      updates.avatar_url = avatarUrl
    }
    if (!existing.terms_accepted_at) {
      updates.terms_accepted_at = now
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = now
      const { error: updateError } = await serviceClient
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (updateError) {
        throw new Error(updateError.message)
      }
    }

    return { created: false, profileId: existing.id }
  }

  const username = await allocateUniqueUsername(
    serviceClient,
    usernameCandidateFromUser(user, name)
  )

  const fullName =
    name.fullName ||
    [name.firstName, name.lastName].filter(Boolean).join(' ').trim() ||
    username

  const { error: insertError } = await serviceClient.from('profiles').insert({
    id: user.id,
    username,
    first_name: name.firstName,
    last_name: name.lastName,
    full_name: fullName,
    avatar_url: avatarUrl,
    terms_accepted_at: now,
    updated_at: now,
  })

  if (insertError) {
    // Concurrent OAuth callback — treat unique/duplicate as already created.
    if (insertError.code === '23505') {
      return { created: false, profileId: user.id }
    }
    throw new Error(insertError.message)
  }

  return { created: true, profileId: user.id }
}
