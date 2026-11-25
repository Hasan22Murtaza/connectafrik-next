import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { writeGschAuditLog } from '@/lib/gsch/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: city, error: cityError } = await supabase
      .from('gsch_cities')
      .select('id, name, is_published')
      .eq('id', id)
      .maybeSingle()

    if (cityError) return errorResponse(cityError.message, 400)
    if (!city) return errorResponse('City not found', 404)

    const { data: existing } = await supabase
      .from('gsch_city_follows')
      .select('id')
      .eq('city_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('gsch_city_follows')
        .delete()
        .eq('id', existing.id)
      if (error) return errorResponse(error.message, 400)

      await writeGschAuditLog(supabase, {
        actor_id: user.id,
        action: 'city_unfollowed',
        entity_type: 'gsch_city',
        entity_id: id,
      })

      return jsonResponse({ followed: false, city_id: id })
    }

    const { error } = await supabase.from('gsch_city_follows').insert({
      city_id: id,
      user_id: user.id,
    })
    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'city_followed',
      entity_type: 'gsch_city',
      entity_id: id,
    })

    return jsonResponse({ followed: true, city_id: id })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to toggle follow', 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error } = await supabase
      .from('gsch_city_follows')
      .delete()
      .eq('city_id', id)
      .eq('user_id', user.id)

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'city_unfollowed',
      entity_type: 'gsch_city',
      entity_id: id,
    })

    return jsonResponse({ followed: false, city_id: id })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to unfollow city', 500)
  }
}
