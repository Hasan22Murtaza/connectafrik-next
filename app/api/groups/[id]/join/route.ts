import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: existingMembership } = await supabase
      .from('group_memberships')
      .select('id, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    let membership: any
    if (existingMembership) {
      if (existingMembership.status === 'active') {
        const { data: m } = await supabase
          .from('group_memberships')
          .select()
          .eq('id', existingMembership.id)
          .single()
        const { count } = await supabase
          .from('group_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', groupId)
          .eq('status', 'active')
        return jsonResponse({
          data: {
            membership: m ?? existingMembership,
            member_count: count ?? 0,
            alreadyMember: true,
          },
        })
      }
      const { data: updated, error: updateErr } = await supabase
        .from('group_memberships')
        .update({ status: 'active' })
        .eq('id', existingMembership.id)
        .select()
        .single()
      if (updateErr) return errorResponse(updateErr.message, 400)
      membership = updated
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('group_memberships')
        .insert({
          group_id: groupId,
          user_id: user.id,
          role: 'member',
          status: 'active',
        })
        .select()
        .single()
      if (insertErr) return errorResponse(insertErr.message, 400)
      membership = inserted
    }

    const { count } = await supabase
      .from('group_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active')

    const memberCount = count ?? 0

    supabase
      .from('groups')
      .update({ member_count: memberCount })
      .eq('id', groupId)
      .then(({ error: updateError }) => {
        if (updateError) console.error('Failed to update member_count:', updateError)
      })

    return jsonResponse({
      data: {
        membership,
        member_count: memberCount,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to join group', 500)
  }
}
