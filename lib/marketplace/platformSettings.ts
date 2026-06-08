import { SupabaseClient } from '@supabase/supabase-js'

const DEFAULTS: Record<string, number> = {
  default_commission_rate: 0.05,
  new_seller_hold_days: 7,
  standard_seller_hold_days: 3,
  trusted_seller_hold_days: 1,
  new_seller_order_threshold: 10,
  trusted_seller_order_threshold: 50,
  auto_release_after_ship_days: 14,
  dispute_buyer_window_days: 30,
}

export async function getPlatformSetting(
  client: SupabaseClient,
  key: string,
  fallback?: number
): Promise<number> {
  const defaultValue = fallback ?? DEFAULTS[key] ?? 0

  const { data } = await client
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (!data?.value) return defaultValue

  const parsed = typeof data.value === 'number' ? data.value : parseFloat(String(data.value))
  return Number.isFinite(parsed) ? parsed : defaultValue
}
