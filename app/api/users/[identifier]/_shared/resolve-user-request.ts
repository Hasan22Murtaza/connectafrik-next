import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { canViewProfile } from '@/shared/utils/visibilityUtils'
import { errorResponse } from '@/lib/api-utils'
import { getRelationship } from '@/lib/privacy/access'
import { privacyDeniedResponse } from '@/lib/privacy/http'
import { PRIVACY_ERRORS } from '@/shared/utils/visibilityUtils'
import type { UserRelationship } from '@/lib/privacy/types'

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
  if (!UUID_RE.test(identifier)) return null
  const { data } = await supabase.from('profiles').select('id').eq('id', identifier).maybeSingle()
  return data?.id ?? null
}

export async function getIsMutual(
  supabase: SupabaseClient,
  viewerId: string,
  ownerId: string
): Promise<boolean> {
  const rel = await getRelationship(viewerId, ownerId, supabase)
  return rel.isFriend
}

export type OwnerContext = {
  supabase: SupabaseClient
  ownerId: string
  profile: Record<string, unknown>
  viewerId: string | null
  isMutual: boolean
  relationship: UserRelationship
}

/** Resolve user, load profile, enforce profile_visibility and blocks for the viewer. */
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

  const relationship = await getRelationship(viewerId, ownerId, supabase)
  const isMutual = relationship.isFriend

  if (!canViewProfile(viewerId, ownerId, relationship.settings.profile_visibility, isMutual, relationship.isBlocked)) {
    return { ok: false, response: privacyDeniedResponse(PRIVACY_ERRORS.profileUnavailable) }
  }

  return {
    ok: true,
    ctx: {
      supabase,
      ownerId,
      profile,
      viewerId,
      isMutual,
      relationship,
    },
  }
}
