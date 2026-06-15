import { SupabaseClient } from '@supabase/supabase-js'

const STRIPE_API = 'https://api.stripe.com/v1'

function getStripeSecret(): string {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  return secret
}

async function stripeRequest(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: Record<string, string>
) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getStripeSecret()}`,
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

export interface SavedPaymentMethod {
  id: string
  user_id: string
  stripe_customer_id: string
  payment_method_id: string
  last_four: string
  card_brand: string
  is_default: boolean
  created_at: string
}

export async function listSavedPaymentMethods(
  serviceClient: SupabaseClient,
  userId: string
): Promise<SavedPaymentMethod[]> {
  const { data, error } = await serviceClient
    .from('stripe_payment_methods')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as SavedPaymentMethod[]
}

async function getOrCreateStripeCustomer(
  serviceClient: SupabaseClient,
  userId: string,
  email?: string | null,
  name?: string
): Promise<string> {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('stripe_customer_id, full_name')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id
  }

  const body: Record<string, string> = {}
  if (email) body.email = email
  if (name || profile?.full_name) body.name = name || profile?.full_name || ''

  const customer = await stripeRequest('/customers', 'POST', body)
  const customerId = customer.id as string

  await serviceClient
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  return customerId
}

export async function addSavedPaymentMethod(
  serviceClient: SupabaseClient,
  userId: string,
  token: string,
  name: string,
  email?: string | null
): Promise<SavedPaymentMethod> {
  const existing = await listSavedPaymentMethods(serviceClient, userId)
  const stripeCustomerId = await getOrCreateStripeCustomer(
    serviceClient,
    userId,
    email,
    name
  )

  const paymentMethod = await stripeRequest('/payment_methods', 'POST', {
    type: 'card',
    'card[token]': token,
  })

  const paymentMethodId = paymentMethod.id as string
  const card = paymentMethod.card as { last4?: string; brand?: string }

  await stripeRequest(`/payment_methods/${paymentMethodId}/attach`, 'POST', {
    customer: stripeCustomerId,
  })

  const isDefault = existing.length === 0

  if (isDefault) {
    await stripeRequest(`/customers/${stripeCustomerId}`, 'POST', {
      'invoice_settings[default_payment_method]': paymentMethodId,
    })
  }

  const { data, error } = await serviceClient
    .from('stripe_payment_methods')
    .insert({
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      payment_method_id: paymentMethodId,
      last_four: card.last4 ?? '0000',
      card_brand: card.brand ?? 'unknown',
      is_default: isDefault,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save payment method')
  }

  return data as SavedPaymentMethod
}

export async function setDefaultPaymentMethod(
  serviceClient: SupabaseClient,
  userId: string,
  paymentMethodId: string
): Promise<SavedPaymentMethod> {
  const { data: profile } = await serviceClient
    .from('stripe_payment_methods')
    .select('*')
    .eq('user_id', userId)
    .eq('payment_method_id', paymentMethodId)
    .single()

  if (!profile) {
    throw new Error('Payment method not found')
  }

  await serviceClient
    .from('stripe_payment_methods')
    .update({ is_default: false })
    .eq('user_id', userId)

  const { data, error } = await serviceClient
    .from('stripe_payment_methods')
    .update({ is_default: true })
    .eq('id', profile.id)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update default payment method')
  }

  await stripeRequest(`/customers/${profile.stripe_customer_id}`, 'POST', {
    'invoice_settings[default_payment_method]': paymentMethodId,
  })

  return data as SavedPaymentMethod
}

export async function deleteSavedPaymentMethod(
  serviceClient: SupabaseClient,
  userId: string,
  paymentMethodId: string
): Promise<void> {
  const { data: profile } = await serviceClient
    .from('stripe_payment_methods')
    .select('*')
    .eq('user_id', userId)
    .eq('payment_method_id', paymentMethodId)
    .single()

  if (!profile) {
    throw new Error('Payment method not found')
  }

  await stripeRequest(`/payment_methods/${paymentMethodId}/detach`, 'POST', {})

  const { error } = await serviceClient
    .from('stripe_payment_methods')
    .delete()
    .eq('id', profile.id)

  if (error) {
    throw new Error(error.message)
  }
}
