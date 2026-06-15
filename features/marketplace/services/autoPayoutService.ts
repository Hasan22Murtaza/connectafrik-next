/**
 * @deprecated Phase 2 replaced client-side Realtime auto-payout with server cron
 * (`/api/internal/cron/release-escrow`).
 * Do not call startAutoPayoutListener() — it is a no-op.
 */

interface AutoPayoutData {
  payout_id: string
  seller_id: string
  amount: number
  order_id: string
}

/** @deprecated Use lib/marketplace/payoutTransfer.executeStripeConnectPayout on the server */
export async function processAutoPayout(_data: AutoPayoutData) {
  console.warn(
    'processAutoPayout is deprecated. Payouts are handled by the escrow cron.'
  )
  return { success: false, status: 'deprecated' }
}

/** @deprecated Realtime listener removed in Phase 2 */
export function startAutoPayoutListener() {
  console.warn(
    'startAutoPayoutListener is deprecated. Configure Vercel cron for /api/internal/cron/release-escrow.'
  )
  return null
}
