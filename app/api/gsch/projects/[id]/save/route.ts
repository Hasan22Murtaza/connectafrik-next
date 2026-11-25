import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params

    const { data: project, error: loadError } = await supabase
      .from('gsch_projects')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!project) return errorResponse('Project not found', 404)

    const { data: existing } = await supabase
      .from('gsch_project_saves')
      .select('id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('gsch_project_saves')
        .delete()
        .eq('id', existing.id)
      if (error) return errorResponse(error.message, 400)
      return jsonResponse({ saved: false })
    }

    const { error } = await supabase.from('gsch_project_saves').insert({
      project_id: id,
      user_id: user.id,
    })
    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ saved: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to toggle save', 500)
  }
}
