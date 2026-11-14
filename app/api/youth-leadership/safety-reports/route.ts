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
  isPlatformYouthAdmin,
  writeYouthAuditLog,
} from '@/lib/youth-leadership/auth'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const admin = searchParams.get('admin') === '1'
    const status = searchParams.get('status')

    if (admin) {
      if (!(await isPlatformYouthAdmin(supabase, user.id))) {
        return forbiddenResponse('Platform admin access required.')
      }
      let query = supabase
        .from('youth_safety_reports')
        .select(
          'id, report_type, description, status, created_at, organization_id, program_id, project_id, event_id, reporter_id'
        )
        .order('created_at', { ascending: false })
        .limit(100)
      if (status) query = query.eq('status', status)
      const { data, error } = await query
      if (error) return errorResponse(error.message, 400)
      return jsonResponse(data || [])
    }

    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    let query = supabase
      .from('youth_safety_reports')
      .select(
        'id, report_type, description, status, created_at, organization_id, program_id, project_id, event_id'
      )
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load safety reports', 500)
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
    if (!body.report_type) return errorResponse('report_type is required', 400)
    if (!body.description?.trim()) return errorResponse('description is required', 400)

    const payload = {
      reporter_id: user.id,
      reported_user_id: body.reported_user_id ?? null,
      program_id: body.program_id ?? null,
      project_id: body.project_id ?? null,
      mentorship_id: body.mentorship_id ?? null,
      organization_id: body.organization_id ?? null,
      report_type: body.report_type,
      description: String(body.description).trim(),
      status: 'open',
    }

    const { data, error } = await supabase
      .from('youth_safety_reports')
      .insert(payload)
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeYouthAuditLog(supabase, {
      actor_id: user.id,
      action: 'safety_report_created',
      entity_type: 'youth_safety_report',
      entity_id: data.id,
      metadata: { report_type: data.report_type },
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create safety report', 500)
  }
}
