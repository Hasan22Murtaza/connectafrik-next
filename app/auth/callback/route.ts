import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getPostAuthRedirect } from '@/lib/auth/postAuthRedirect'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('redirect') ?? '/feed'

  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/feed'
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // setAll can fail when called from a Server Component context
            }
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      let platformRole: string | null = null
      if (data.user?.id) {
        try {
          const serviceClient = createServiceClient()
          const { data: profile } = await serviceClient
            .from('profiles')
            .select('platform_role')
            .eq('id', data.user.id)
            .maybeSingle()
          platformRole = profile?.platform_role ?? null
        } catch {
          platformRole = null
        }
      }

      next = getPostAuthRedirect(platformRole, next)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=auth`)
}
