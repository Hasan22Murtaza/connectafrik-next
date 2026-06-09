import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'

export type MarketplaceAdminRole = 'admin' | 'super_admin'

function getBootstrapAdminIds(): string[] {
  return (
    process.env.MARKETPLACE_ADMIN_USER_IDS?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? []
  )
}

export async function isMarketplaceAdmin(userId: string): Promise<boolean> {
  if (getBootstrapAdminIds().includes(userId)) {
    return true
  }

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('platform_role')
    .eq('id', userId)
    .single()

  const role = profile?.platform_role as MarketplaceAdminRole | 'user' | undefined
  return role === 'admin' || role === 'super_admin'
}

export async function requireMarketplaceAdmin(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (getBootstrapAdminIds().includes(user.id)) {
    return { user, supabase }
  }

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('platform_role')
    .eq('id', user.id)
    .single()

  const role = profile?.platform_role as MarketplaceAdminRole | 'user' | undefined
  if (role === 'admin' || role === 'super_admin') {
    return { user, supabase }
  }

  throw new Error('Forbidden')
}
