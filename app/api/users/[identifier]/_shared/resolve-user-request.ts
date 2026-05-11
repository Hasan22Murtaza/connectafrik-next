import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { canViewProfile } from '@/shared/utils/visibilityUtils'
import { errorResponse } from '@/lib/api-utils'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getSupabaseAndViewer(request: NextRequest): Promise<{
  supabase: SupabaseClient
  viewerId: string | null
}> {
  try {
    const auth = await getAuthenticatedUser(request)
    return { supabase: auth.supabase, viewerId: auth.user.id }
  } catch {
    return {
      supabase: createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
      viewerId: null,
    }
  }
}

export async function resolveOwnerId(
  supabase: SupabaseClient,
  identifier: string
): Promise<string | null> {
  if (UUID_RE.test(identifier)) {
    const { data } = await supabase.from('profiles').select('id').eq('id', identifier).maybeSingle()
    return data?.id ?? null
  }
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', identifier)
    .maybeSingle()
  return data?.id ?? null
}

export async function getIsMutual(
  supabase: SupabaseClient,
  viewerId: string,
  ownerId: string
): Promise<boolean> {
  if (viewerId === ownerId) return true
  const [a, b] = await Promise.all([
    supabase.from('follows').select('id').eq('follower_id', viewerId).eq('following_id', ownerId).maybeSingle(),
    supabase.from('follows').select('id').eq('follower_id', ownerId).eq('following_id', viewerId).maybeSingle(),
  ])
  return Boolean(a.data && b.data)
}

export type OwnerContext = {
  supabase: SupabaseClient
  ownerId: string
  profile: Record<string, unknown>
  viewerId: string | null
  isMutual: boolean
}

/** Resolve user, load profile, enforce profile_visibility for the viewer. */
export async function requireProfileAccess(
  request: NextRequest,
  identifier: string
): Promise<{ ok: true; ctx: OwnerContext } | { ok: false; response: Response }> {
  const { supabase, viewerId } = await getSupabaseAndViewer(request)
  const ownerId = await resolveOwnerId(supabase, identifier)
  if (!ownerId) {
    return { ok: false, response: errorResponse('User not found', 404) }
  }

  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', ownerId).single()

  if (error || !profile) {
    return { ok: false, response: errorResponse('User not found', 404) }
  }

  const isOwn = viewerId === ownerId
  const isMutual =
    isOwn ||
    (viewerId != null && (await getIsMutual(supabase, viewerId, ownerId)))

  const pv = (profile as { profile_visibility?: string }).profile_visibility || 'public'
  if (!canViewProfile(viewerId, ownerId, pv as 'public' | 'friends' | 'private' | 'everyone', isMutual)) {
    return { ok: false, response: errorResponse('This profile is not available', 403) }
  }

  return {
    ok: true,
    ctx: {
      supabase,
      ownerId,
      profile,
      viewerId,
      isMutual,
    },
  }
}
