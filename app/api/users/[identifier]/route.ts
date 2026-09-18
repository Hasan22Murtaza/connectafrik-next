import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { lookupDirectThreadIdBetweenUsers } from '@/lib/chat/chatThreadLookup'
import { getRelationship } from '@/lib/privacy/access'
import { sanitizeProfileForViewer } from '@/lib/privacy/sanitize'
import { getSupabaseAndViewer, UUID_RE } from './_shared/resolve-user-request'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params

    if (identifier === 'me') {
      const auth = await getAuthenticatedUser(request)
      const { data: profile, error } = await auth.supabase
        .from('profiles')
        .select('*')
        .eq('id', auth.user.id)
        .single()

      if (error || !profile) {
        return errorResponse('Profile not found', 404)
      }
      return jsonResponse({ data: { ...profile, threadId: null, profile_restricted: false } })
    }

    if (!UUID_RE.test(identifier)) {
      return errorResponse('Invalid user id', 400)
    }

    const { supabase, viewerId } = await getSupabaseAndViewer(request)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', identifier)
      .single()

    if (error || !profile) {
      return errorResponse('User not found', 404)
    }

    const relationship = await getRelationship(viewerId, profile.id, supabase)
    const sanitized = sanitizeProfileForViewer(profile as Record<string, unknown>, viewerId, relationship)

    const threadId =
      viewerId && viewerId !== profile.id && !relationship.isBlocked
        ? (await lookupDirectThreadIdBetweenUsers(viewerId, profile.id)) ?? null
        : null

    return jsonResponse({ data: { ...sanitized, threadId } })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch user', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    if (identifier !== 'me' && identifier !== user.id) {
      return errorResponse('Can only update your own profile', 403)
    }

    const body = await request.json()
    const updates = { ...body, updated_at: new Date().toISOString() } as Record<string, unknown>
    delete updates.id
    delete updates.created_at
    delete updates.location
    delete updates.region

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('*')
      .single()

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ data: { ...profile, threadId: null } })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update profile', 500)
  }
}
