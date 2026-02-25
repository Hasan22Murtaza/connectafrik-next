import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const GROUP_SELECT = `
  *,
  creator:profiles!creator_id(id, username, full_name, avatar_url),
  memberships:group_memberships(id, user_id, role, status, joined_at, updated_at)
`

export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const search = searchParams.get('search') || undefined
    const country = searchParams.get('country') || undefined
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100)
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('is_active', true)
      .order('member_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (category) {
      query = query.eq('category', category)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (country) {
      query = query.eq('country', country)
    }

    const { data: groupsData, error } = await query

    if (error) {
      return errorResponse(error.message, 400)
    }

    const groups = groupsData || []
    const processed = groups.map((group: any) => {
      const activeMemberships = (group.memberships || []).filter((m: any) => m.status === 'active')
      const userMembership = userId
        ? activeMemberships.find((m: any) => m.user_id === userId)
        : undefined
      return {
        ...group,
        member_count: activeMemberships.length,
        membership: userMembership
          ? {
              id: userMembership.id,
              group_id: group.id,
              user_id: userMembership.user_id,
              role: userMembership.role,
              status: userMembership.status,
              joined_at: userMembership.joined_at,
              updated_at: userMembership.updated_at,
            }
          : undefined,
        memberships: undefined,
      }
    })

    return jsonResponse({ data: processed, page, pageSize: limit, hasMore: groups.length === limit })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch groups', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const {
      name,
      description,
      category,
      goals,
      is_public,
      max_members,
      location,
      country,
      tags,
      rules,
      avatar_url,
      banner_url,
    } = body

    const normalizedName = String(name || '').trim()
    const normalizedDescription = String(description || '').trim()

    if (!normalizedName || !normalizedDescription) {
      return errorResponse('Name and description are required', 400)
    }

    // Prevent accidental double-creates from rapid duplicate submits.
    const duplicateWindowStart = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: existingGroup } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('creator_id', user.id)
      .eq('name', normalizedName)
      .eq('description', normalizedDescription)
      .gte('created_at', duplicateWindowStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingGroup) {
      let existingMembership = (existingGroup.memberships || []).find(
        (m: any) => m.user_id === user.id && m.status === 'active'
      )
      if (!existingMembership) {
        const { data } = await supabase
          .from('group_memberships')
          .select('id, user_id, role, status, joined_at, updated_at')
          .eq('group_id', existingGroup.id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()
        existingMembership = data
      }

      return jsonResponse({
        data: {
          ...existingGroup,
          member_count: existingGroup.member_count ?? 1,
          membership: existingMembership
            ? {
                id: existingMembership.id,
                group_id: existingGroup.id,
                user_id: existingMembership.user_id,
                role: existingMembership.role,
                status: existingMembership.status,
                joined_at: existingMembership.joined_at,
                updated_at: existingMembership.updated_at,
              }
            : undefined,
          memberships: undefined,
        },
      })
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: normalizedName,
        description: normalizedDescription,
        category: category || 'community',
        goals: goals || [],
        is_public: is_public !== false,
        max_members: max_members ?? 100,
        location: location || null,
        country: country || null,
        tags: tags || [],
        rules: rules || [],
        avatar_url: avatar_url || null,
        banner_url: banner_url || null,
        creator_id: user.id,
        member_count: 1,
      })
      .select(GROUP_SELECT)
      .single()

    if (groupError) {
      return errorResponse(groupError.message, 400)
    }

    const { data: insertedMembership, error: membershipError } = await supabase
      .from('group_memberships')
      .insert({
        group_id: group.id,
        user_id: user.id,
        role: 'admin',
        status: 'active',
      })
      .select()
      .single()

    let membership = insertedMembership
    if (membershipError) {
      const isDuplicateMembership =
        membershipError.code === '23505' ||
        membershipError.message?.includes('unique_group_membership')

      if (!isDuplicateMembership) {
        return errorResponse(membershipError.message, 400)
      }

      // Some environments auto-create creator membership (trigger); reuse it.
      const { data: existingMembership, error: existingMembershipError } = await supabase
        .from('group_memberships')
        .select('id, user_id, role, status, joined_at, updated_at')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (existingMembershipError || !existingMembership) {
        return errorResponse(existingMembershipError?.message || 'Failed to fetch group membership', 400)
      }

      membership = existingMembership
    }

    const { error: updateError } = await supabase
      .from('groups')
      .update({ member_count: 1 })
      .eq('id', group.id)

    if (updateError) {
      return errorResponse(updateError.message, 400)
    }

    const activeMemberships = (group.memberships || []).filter((m: any) => m.status === 'active')
    const result = {
      ...group,
      member_count: 1,
      membership: {
        id: membership!.id,
        group_id: group.id,
        user_id: membership!.user_id,
        role: membership!.role,
        status: membership!.status,
        joined_at: membership!.joined_at,
        updated_at: membership!.updated_at,
      },
      memberships: undefined,
    }

    return jsonResponse({ data: result }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to create group', 500)
  }
}
