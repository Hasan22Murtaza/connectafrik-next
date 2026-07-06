import { NextRequest, NextResponse } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createAuthClient } from '../_shared'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return errorResponse('Email and password are required', 400)
    }

    const supabase = createAuthClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const message = error.message || 'Failed to sign in'
      const isUnverified =
        message.toLowerCase().includes('email not confirmed') ||
        message.toLowerCase().includes('email not verified')

      if (isUnverified) {
        return NextResponse.json(
          {
            success: false,
            data: { code: 'EMAIL_NOT_VERIFIED', email },
            message,
          },
          { status: 403 }
        )
      }

      return errorResponse(message, 400)
    }

    let profileAvatarUrl: string | null = null
    let platformRole: string | null = null
    if (data.user?.id) {
      try {
        const serviceSupabase = createServiceClient()
        const { data: profile } = await serviceSupabase
          .from('profiles')
          .select('avatar_url, platform_role')
          .eq('id', data.user.id)
          .maybeSingle()
        profileAvatarUrl = profile?.avatar_url || null
        platformRole = profile?.platform_role || null
      } catch {
        profileAvatarUrl = null
        platformRole = null
      }
    }

    const avatarUrl =
      data.user?.user_metadata?.avatar_url ||
      data.user?.user_metadata?.picture ||
      data.user?.user_metadata?.profile_image ||
      profileAvatarUrl ||
      null

    const user = data.user
      ? {
          ...data.user,
          user_metadata: {
            ...(data.user.user_metadata || {}),
            avatar_url: avatarUrl,
          },
        }
      : data.user

    const session = data.session
      ? {
          ...data.session,
          user: data.session.user
            ? {
                ...data.session.user,
                user_metadata: {
                  ...(data.session.user.user_metadata || {}),
                  avatar_url: avatarUrl,
                },
              }
            : data.session.user,
        }
      : data.session

    return jsonResponse({
      user,
      session,
      platform_role: platformRole,
    })
  } catch (error: any) {
    return errorResponse(error?.message || 'Failed to sign in', 500)
  }
}
