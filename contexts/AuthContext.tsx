'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { checkAndSetupFCMTokenOnLogin, deactivateTokenOnLogout } from '@/shared/utils/fcmClient'
import { flushUserPresenceOnLeave } from '@/lib/flushUserPresenceOnLeave'
import { useTheme } from '@/shared/theme/useTheme'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>
  /** Ends this browser/session only (other devices stay signed in). */
  signOut: () => Promise<void>
  /** Ends every session for this account on all devices. */
  signOutAllDevices: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Keep the same `user` object reference across TOKEN_REFRESHED / duplicate
 * INITIAL_SESSION events so downstream effects keyed on `user` do not remount.
 * Only replace when the user id changes, the user signs out, or USER_UPDATED.
 */
function nextStableUser(
  prev: User | null,
  next: User | null,
  event: string
): User | null {
  if (!next) return null
  if (event === 'USER_UPDATED') return next
  if (prev?.id === next.id) return prev
  return next
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { setTheme } = useTheme()
  const setThemeRef = useRef(setTheme)
  setThemeRef.current = setTheme

  const resetThemeToLight = useCallback(() => {
    setThemeRef.current('light')
  }, [])

  useEffect(() => {
    // Get initial session (guard against refresh_token_not_found / invalid session)
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession)
        setUser((prev) => nextStableUser(prev, initialSession?.user ?? null, 'INITIAL_SESSION'))
        setLoading(false)
        if (initialSession?.user && typeof window !== 'undefined') {
          checkAndSetupFCMTokenOnLogin()
        }
      })
      .catch(() => {
        setSession(null)
        setUser(null)
        setLoading(false)
      })

    // Listen for auth changes (guard against malformed session updates)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      try {
        // Always refresh session tokens; stabilize user identity separately.
        setSession(nextSession ?? null)
        setUser((prev) => nextStableUser(prev, nextSession?.user ?? null, event))
        setLoading(false)
        if (event === 'SIGNED_IN' && nextSession?.user && typeof window !== 'undefined') {
          checkAndSetupFCMTokenOnLogin()
        }
        if (event === 'SIGNED_OUT') {
          resetThemeToLight()
        }
      } catch {
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [resetThemeToLight])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
        data?: { session?: { access_token: string; refresh_token: string } }
      } | null

      if (!response.ok || body?.success === false) {
        return {
          error: {
            message: body?.message || 'Failed to sign in',
          } as AuthError,
        }
      }

      const sessionTokens = body?.data?.session
      if (sessionTokens?.access_token && sessionTokens?.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: sessionTokens.access_token,
          refresh_token: sessionTokens.refresh_token,
        })
        return { error }
      }

      return {
        error: { message: 'Sign in succeeded, but no session was returned.' } as AuthError,
      }
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to sign in',
        } as AuthError,
      }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { error }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    try {
      await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      return { error: null }
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to send reset code',
        } as AuthError,
      }
    }
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password,
    })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    resetThemeToLight()
    await deactivateTokenOnLogout().catch(() => {})
    await flushUserPresenceOnLeave()
    await supabase.auth.signOut({ scope: 'local' })
    router.push('/')
  }, [resetThemeToLight, router])

  const signOutAllDevices = useCallback(async () => {
    resetThemeToLight()
    await deactivateTokenOnLogout().catch(() => {})
    await flushUserPresenceOnLeave()
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/')
  }, [resetThemeToLight, router])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,
      signIn,
      signUp,
      resetPassword,
      updatePassword,
      signOut,
      signOutAllDevices,
    }),
    [
      user,
      session,
      loading,
      signIn,
      signUp,
      resetPassword,
      updatePassword,
      signOut,
      signOutAllDevices,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
