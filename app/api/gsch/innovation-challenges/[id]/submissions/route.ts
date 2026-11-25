import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { notifyGschOrgOwners } from '@/lib/gsch/notify'
import {
  GSCH_INNOVATION_SUBMISSION_SELECT,
  parseGschTags,
} from '@/lib/gsch/selects'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params

    const { data: challenge, error: loadError } = await supabase
      .from('gsch_innovation_challenges')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!challenge) return errorResponse('Innovation challenge not found', 404)

    const authz = await requireOrgRole(
      supabase,
      challenge.organization_id,
      user.id,
      'member'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    const { data, error } = await supabase
      .from('gsch_innovation_submissions')
      .select(GSCH_INNOVATION_SUBMISSION_SELECT)
      .eq('challenge_id', id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({
      data: data || [],
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load submissions', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const body = await request.json()

    if (!body.title?.trim()) return errorResponse('title is required', 400)
    if (!body.proposal?.trim()) return errorResponse('proposal is required', 400)

    const { data: challenge, error: loadError } = await supabase
      .from('gsch_innovation_challenges')
      .select('id, organization_id, title, is_published, status')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!challenge) return errorResponse('Innovation challenge not found', 404)
    if (!challenge.is_published) {
      return errorResponse('Challenge is not published', 400)
    }
    if (challenge.status !== 'open') {
      return errorResponse('Challenge is not open for submissions', 400)
    }

    if (body.organization_id) {
      const authz = await requireOrgRole(
        supabase,
        body.organization_id,
        user.id,
        'member'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
    }

    const { data, error } = await supabase
      .from('gsch_innovation_submissions')
      .insert({
        challenge_id: id,
        organization_id: body.organization_id || null,
        submitter_user_id: user.id,
        title: String(body.title).trim(),
        proposal: String(body.proposal).trim(),
        document_urls: parseGschTags(body.document_urls),
        contact_email: body.contact_email?.trim() || null,
        status: 'submitted',
      })
      .select(GSCH_INNOVATION_SUBMISSION_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'innovation_submission_created',
      entity_type: 'gsch_innovation_submission',
      entity_id: data.id,
      metadata: { challenge_id: id },
    })

    await notifyGschOrgOwners(supabase, challenge.organization_id, {
      type: 'gsch_innovation_submission',
      title: 'Innovation submission received',
      message: `A proposal was submitted to “${challenge.title}”.`,
      data: {
        challenge_id: id,
        submission_id: data.id,
        type: 'gsch_innovation_submission',
      },
      excludeUserId: user.id,
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to submit proposal', 500)
  }
}
