import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isStripeConnectEnabled, deriveAccountStatus } from '@/lib/marketplace/stripeConnect'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

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

    const { data: profile } = await serviceClient
      .from('profiles')
      .select(
        'stripe_connect_account_id, stripe_connect_onboarded, stripe_connect_payouts_enabled, full_name'
      )
      .eq('id', user.id)
      .single()

    let accountId = profile?.stripe_connect_account_id ?? null

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: profile?.full_name ? { name: profile.full_name } : undefined,
      })

      accountId = account.id

      await serviceClient
        .from('profiles')
        .update({
          stripe_connect_account_id: accountId,
          payout_method: 'stripe_connect',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    const linkType =
      profile?.stripe_connect_onboarded && profile?.stripe_connect_payouts_enabled
        ? 'account_update'
        : 'account_onboarding'

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: linkType,
    })

    return jsonResponse({
      data: {
        url: link.url,
        account_id: accountId,
        accountStatus: deriveAccountStatus({
          stripe_connect_account_id: accountId,
          stripe_connect_onboarded: profile?.stripe_connect_onboarded,
        }),
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
