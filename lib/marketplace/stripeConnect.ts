import { SupabaseClient } from '@supabase/supabase-js'

const STRIPE_API = 'https://api.stripe.com/v1'

function getStripeSecret(): string | null {
  return process.env.STRIPE_SECRET_KEY ?? null
}

async function stripeRequest(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, string>
) {
  const secret = getStripeSecret()
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }

  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  })

  const payload = (await response.json()) as Record<string, unknown> & {
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe API error (${response.status})`)
  }

  return payload
}

export async function createConnectExpressAccount(
  serviceClient: SupabaseClient,
  sellerId: string,
  email?: string | null
): Promise<string> {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('stripe_connect_account_id, full_name')
    .eq('id', sellerId)
    .single()

  if (profile?.stripe_connect_account_id) {
    return profile.stripe_connect_account_id
  }

  const body: Record<string, string> = {
    type: 'express',
    'capabilities[transfers][requested]': 'true',
  }
  if (email) body.email = email
  if (profile?.full_name) body['business_profile[name]'] = profile.full_name

  const account = await stripeRequest('/accounts', 'POST', body)
  const accountId = account.id as string

  await serviceClient
    .from('profiles')
    .update({
      stripe_connect_account_id: accountId,
      payout_method: 'stripe_connect',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sellerId)

  return accountId
}

export async function createConnectOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  const link = await stripeRequest('/account_links', 'POST', {
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  })

  return link.url as string
}

export async function syncConnectAccountStatus(
  serviceClient: SupabaseClient,
  sellerId: string
) {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', sellerId)
    .single()

  if (!profile?.stripe_connect_account_id) {
    return { onboarded: false, charges_enabled: false, payouts_enabled: false }
  }

  const account = await stripeRequest(
    `/accounts/${profile.stripe_connect_account_id}`,
    'GET'
  )

  const chargesEnabled = Boolean(account.charges_enabled)
  const payoutsEnabled = Boolean(account.payouts_enabled)
  const onboarded = Boolean(account.details_submitted)

  await serviceClient
    .from('profiles')
    .update({
      stripe_connect_onboarded: onboarded,
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sellerId)

  return { onboarded, charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled }
}

export async function createConnectTransfer(params: {
  amount: number
  currency: string
  destinationAccountId: string
  orderId: string
  payoutId: string
}) {
  const transfer = await stripeRequest('/transfers', 'POST', {
    amount: String(Math.round(params.amount * 100)),
    currency: params.currency.toLowerCase(),
    destination: params.destinationAccountId,
    transfer_group: params.orderId,
    'metadata[payout_id]': params.payoutId,
    'metadata[order_id]': params.orderId,
  })

  return {
    transfer_id: transfer.id as string,
    status: 'success',
    reference: transfer.id as string,
  }
}

export function isStripeConnectEnabled(): boolean {
  return (
    process.env.STRIPE_SECRET_KEY != null &&
    process.env.MARKETPLACE_STRIPE_CONNECT_ENABLED !== 'false'
  )
}
