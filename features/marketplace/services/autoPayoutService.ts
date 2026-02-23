import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'

interface AutoPayoutData {
  payout_id: string
  seller_id: string
  amount: number
  order_id: string
}

export async function processAutoPayout(data: AutoPayoutData) {
  const result = await apiClient.post<{
    success: boolean
    transfer_code: string
    reference: string
    status: string
    method: string
  }>('/api/marketplace/checkout/payout/process', data)

  return result
}

export function startAutoPayoutListener() {
  const channel = supabase.channel('auto_payout_channel')

  channel
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'seller_payouts',
      filter: 'status=eq.processing'
    }, async (payload) => {
      console.log('New payout detected:', payload.new)

      const payout = payload.new as any

      try {
        await processAutoPayout({
          payout_id: payout.id,
          seller_id: payout.seller_id,
          amount: payout.amount,
          order_id: payout.order_id
        })
      } catch (error: any) {
        console.error(`Failed to process payout ${payout.id}:`, error)
      }
    })
    .subscribe()

  return channel
}
