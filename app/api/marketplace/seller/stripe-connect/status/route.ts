import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { syncConnectAccountStatus, isStripeConnectEnabled } from '@/lib/marketplace/stripeConnect'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: profile } = await serviceClient
      .from('profiles')
      .select(`
        stripe_connect_account_id,
        stripe_connect_onboarded,
        stripe_connect_charges_enabled,
        stripe_connect_payouts_enabled,
        seller_reserve_balance
      `)
      .eq('id', user.id)
      .single()

    if (profile?.stripe_connect_account_id && isStripeConnectEnabled()) {
      await syncConnectAccountStatus(serviceClient, user.id)
      const { data: updated } = await serviceClient
        .from('profiles')
        .select(`
          stripe_connect_account_id,
          stripe_connect_onboarded,
          stripe_connect_charges_enabled,
          stripe_connect_payouts_enabled,
          seller_reserve_balance
        `)
        .eq('id', user.id)
        .single()

      return jsonResponse({
        data: {
          enabled: isStripeConnectEnabled(),
          ...updated,
        },
      })
    }

    return jsonResponse({
      data: {
        enabled: isStripeConnectEnabled(),
        stripe_connect_account_id: profile?.stripe_connect_account_id ?? null,
        stripe_connect_onboarded: profile?.stripe_connect_onboarded ?? false,
        stripe_connect_charges_enabled: profile?.stripe_connect_charges_enabled ?? false,
        stripe_connect_payouts_enabled: profile?.stripe_connect_payouts_enabled ?? false,
        seller_reserve_balance: profile?.seller_reserve_balance ?? 0,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
