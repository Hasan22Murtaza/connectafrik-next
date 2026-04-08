import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** GoTrue REST expects this on user endpoints (matches @supabase/auth-js). */
const GOTRUE_API_VERSION = '2024-01-01'

export function getAccessTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')?.trim()
  return token || null
}

/**
 * Update password using the user's JWT. Required on the server because
 * `supabase.auth.updateUser()` only works when a session is loaded in the client.
 */
export async function updateUserPasswordViaGotrue(
  accessToken: string,
  newPassword: string
): Promise<{ error: string | null }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      'X-Supabase-Api-Version': GOTRUE_API_VERSION,
    },
    body: JSON.stringify({ password: newPassword }),
  })

  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    /* empty */
  }

  if (!res.ok) {
    const weak = body.weak_password as { reasons?: string[] } | undefined
    if (weak?.reasons?.length) {
      return { error: weak.reasons.join('. ') }
    }
    const msg =
      (typeof body.msg === 'string' && body.msg) ||
      (typeof body.message === 'string' && body.message) ||
      (typeof body.error_description === 'string' && body.error_description) ||
      `Failed to update password (${res.status})`
    return { error: msg }
  }

  return { error: null }
}

export function createServiceClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

export function createAuthenticatedClient(request: Request): SupabaseClient {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    throw new Error('Missing Authorization header')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })
}

export async function getAuthenticatedUser(request: Request) {
  const supabase = createAuthenticatedClient(request)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return { user, supabase }
}
