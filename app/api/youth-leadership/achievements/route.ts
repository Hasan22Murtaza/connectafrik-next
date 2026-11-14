import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  checkYouthLeadershipAccess,
  requireOrgRole,
} from '@/lib/youth-leadership/auth'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const status = new URL(request.url).searchParams.get('status')
    let query = supabase
      .from('youth_achievements')
      .select(
        'id, title, description, achievement_type, skills, verification_status, certificate_url, verified_at, badge_slug, created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('verification_status', status)

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load achievements', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const body = await request.json()
    if (!body.title?.trim()) return errorResponse('title is required', 400)
    if (!body.achievement_type) return errorResponse('achievement_type is required', 400)

    const organizationId = body.organization_id ?? null
    const targetUserId = (body.user_id as string) || user.id
    const isSelf = targetUserId === user.id

    if (!isSelf) {
      if (!organizationId) {
        return errorResponse(
          'organization_id is required when creating achievements for others.',
          400
        )
      }
      const authz = await requireOrgRole(supabase, organizationId, user.id, 'coordinator')
      if (!authz.ok) return forbiddenResponse(authz.message)
    } else if (organizationId) {
      // Self-create with org link is fine; stay pending unless coordinator creates for someone else
    }

    // Participants creating for self must be pending; coordinators may set verified
    let verificationStatus = 'pending'
    if (!isSelf && body.verification_status === 'verified') {
      verificationStatus = 'verified'
    }

    const payload = {
      user_id: targetUserId,
      program_id: body.program_id ?? null,
      project_id: body.project_id ?? null,
      organization_id: organizationId,
      achievement_type: body.achievement_type,
      title: String(body.title).trim(),
      description: body.description ?? null,
      skills: Array.isArray(body.skills) ? body.skills : null,
      verification_status: verificationStatus,
      verified_by: verificationStatus === 'verified' ? user.id : null,
      verified_at: verificationStatus === 'verified' ? new Date().toISOString() : null,
      certificate_url: body.certificate_url ?? null,
      badge_slug: body.badge_slug ?? null,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('youth_achievements')
      .insert(payload)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create achievement', 500)
  }
}
