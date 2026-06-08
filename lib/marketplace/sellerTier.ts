import { SupabaseClient } from '@supabase/supabase-js'
import { getPlatformSetting } from './platformSettings'

export type SellerTier = 'new' | 'standard' | 'trusted'

export async function getCompletedSalesCount(
  client: SupabaseClient,
  sellerId: string
): Promise<number> {
  const { count } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .in('status', ['completed'])
    .eq('payment_status', 'completed')

  return count ?? 0
}

export async function resolveSellerTier(
  client: SupabaseClient,
  sellerId: string
): Promise<SellerTier> {
  const { data: profile } = await client
    .from('profiles')
    .select('seller_tier')
    .eq('id', sellerId)
    .maybeSingle()

  if (profile?.seller_tier) {
    return profile.seller_tier as SellerTier
  }

  const completedSales = await getCompletedSalesCount(client, sellerId)
  const trustedThreshold = await getPlatformSetting(client, 'trusted_seller_order_threshold', 50)
  const newThreshold = await getPlatformSetting(client, 'new_seller_order_threshold', 10)

  if (completedSales >= trustedThreshold) return 'trusted'
  if (completedSales >= newThreshold) return 'standard'
  return 'new'
}

export async function getSellerHoldDays(
  client: SupabaseClient,
  sellerId: string
): Promise<{ tier: SellerTier; holdDays: number }> {
  const tier = await resolveSellerTier(client, sellerId)

  const settingKey =
    tier === 'trusted'
      ? 'trusted_seller_hold_days'
      : tier === 'standard'
        ? 'standard_seller_hold_days'
        : 'new_seller_hold_days'

  const holdDays = await getPlatformSetting(client, settingKey, tier === 'trusted' ? 1 : tier === 'standard' ? 3 : 7)

  return { tier, holdDays: Math.max(0, Math.floor(holdDays)) }
}
