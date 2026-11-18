'use client'

import { supabase } from '@/lib/supabase'
import type { Provider } from '@supabase/supabase-js'

export type SocialOAuthProvider = Extract<Provider, 'google' | 'apple'>

/**
 * Start a Supabase OAuth redirect for Google/Apple using the same-origin
 * PKCE callback (`/auth/callback`) so host-scoped verifier cookies stay valid.
 */
export async function startOAuthSignIn(
  provider: SocialOAuthProvider,
  redirectPath?: string | null
): Promise<{ error: Error | null }> {
  const redirectTo = redirectPath && redirectPath.startsWith('/') && !redirectPath.startsWith('//')
    ? redirectPath
    : '/feed'

  const callbackUrl = new URL('/auth/callback', window.location.origin)
  callbackUrl.searchParams.set('redirect', redirectTo)

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString(),
    },
  })

  return { error: error ? new Error(error.message) : null }
}
