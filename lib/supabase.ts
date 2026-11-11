import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Single browser client (cookie storage, compatible with middleware).
// Do not create additional createBrowserClient() instances — that multiplies auth/v1/user traffic.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  isSingleton: true,
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

