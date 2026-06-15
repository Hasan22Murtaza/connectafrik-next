import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  createConnectExpressAccount,
  createConnectOnboardingLink,
  isStripeConnectEnabled,
} from '@/lib/marketplace/stripeConnect'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)

    if (!isStripeConnectEnabled()) {
      return errorResponse('Stripe Connect is not enabled on this platform', 400)
    }

    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const returnUrl =
      (body.return_url as string) ||
      `${origin}/marketplace/selling/payout-settings?stripe=return`
    const refreshUrl =
      (body.refresh_url as string) ||
      `${origin}/marketplace/selling/payout-settings?stripe=refresh`

    const accountId = await createConnectExpressAccount(
      serviceClient,
      user.id,
      user.email
    )

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_connect_onboarded, stripe_connect_payouts_enabled')
      .eq('id', user.id)
      .single()

    const linkType =
      profile?.stripe_connect_onboarded && profile?.stripe_connect_payouts_enabled
        ? 'account_update'
        : 'account_onboarding'

    const onboardingUrl = await createConnectOnboardingLink(
      accountId,
      returnUrl,
      refreshUrl,
      linkType
    )

    return jsonResponse({ data: { url: onboardingUrl, account_id: accountId } })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
