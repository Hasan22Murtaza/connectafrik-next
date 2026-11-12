import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { checkYouthLeadershipAccess } from '@/lib/youth-leadership/auth'

const MENTOR_SELECT = `
  *,
  profile:profiles!user_id(id, username, full_name, avatar_url)
`

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const { searchParams } = new URL(request.url)
    const skill = searchParams.get('skill')
    const expertise = searchParams.get('expertise')
    const language = searchParams.get('language')
    const acceptsMinors = searchParams.get('accepts_minors')
    const mine = searchParams.get('mine') === '1'
    const search = searchParams.get('search')?.trim() || ''

    let query = supabase.from('youth_mentors').select(MENTOR_SELECT)

    if (mine) {
      query = query.eq('user_id', user.id)
    } else {
      query = query.eq('verification_status', 'verified')
    }

    if (skill) query = query.contains('skills', [skill])
    if (expertise) query = query.contains('expertise', [expertise])
    if (language) query = query.contains('languages', [language])
    if (acceptsMinors === '1' || acceptsMinors === 'true') {
      query = query.eq('accepts_minors', true)
    }

    query = query.order('updated_at', { ascending: false })

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    let mentors = data || []
    if (search) {
      const q = search.toLowerCase()
      mentors = mentors.filter((m: any) => {
        const hay = [
          m.bio,
          m.experience_summary,
          ...(m.skills || []),
          ...(m.expertise || []),
          m.profile?.full_name,
          m.profile?.username,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }

    return jsonResponse(mentors)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load mentors', 500)
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

    const body = await request.json().catch(() => ({}))

    const payload = {
      user_id: user.id,
      expertise: Array.isArray(body.expertise) ? body.expertise : null,
      skills: Array.isArray(body.skills) ? body.skills : null,
      bio: body.bio ?? null,
      languages: Array.isArray(body.languages) ? body.languages : null,
      experience_summary: body.experience_summary ?? null,
      mentorship_interests: Array.isArray(body.mentorship_interests)
        ? body.mentorship_interests
        : null,
      availability:
        body.availability && typeof body.availability === 'object'
          ? body.availability
          : {},
      accepts_minors: Boolean(body.accepts_minors),
    }

    const { data: existing } = await supabase
      .from('youth_mentors')
      .select('id, verification_status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Do not allow self-changing verification_status
      const { data, error } = await supabase
        .from('youth_mentors')
        .update(payload)
        .eq('id', existing.id)
        .select(MENTOR_SELECT)
        .single()
      if (error) return errorResponse(error.message, 400)
      return jsonResponse(data)
    }

    const { data, error } = await supabase
      .from('youth_mentors')
      .insert({ ...payload, verification_status: 'pending' })
      .select(MENTOR_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to save mentor profile', 500)
  }
}
