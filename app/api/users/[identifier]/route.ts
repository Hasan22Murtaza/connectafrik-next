import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    let supabase

    if (identifier === 'me') {
      const auth = await getAuthenticatedUser(request)
      supabase = auth.supabase
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', auth.user.id)
        .single()

      if (error || !profile) {
        return errorResponse('Profile not found', 404)
      }
      return jsonResponse({ data: profile })
    }

    try {
      const auth = await getAuthenticatedUser(request)
      supabase = auth.supabase
    } catch {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }

    const isUUID = UUID_RE.test(identifier)
    const query = supabase.from('profiles').select('*')
    const { data: profile, error } = isUUID
      ? await query.eq('id', identifier).single()
      : await query.eq('username', identifier).single()

    if (error || !profile) {
      return errorResponse('User not found', 404)
    }

    return jsonResponse({ data: profile })
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
    const updates = { ...body, updated_at: new Date().toISOString() }
    delete updates.id
    delete updates.created_at

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('*')
      .single()

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ data: profile })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update profile', 500)
  }
}
