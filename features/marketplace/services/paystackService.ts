import { apiClient } from '@/lib/api-client'

/**
 * Paystack-supported currencies for ConnectAfrik
 */
export const PAYSTACK_CURRENCIES = ['NGN', 'GHS', 'ZAR', 'KES'] as const
export type PaystackCurrency = typeof PAYSTACK_CURRENCIES[number]

/**
 * Calculate Paystack fees by currency
 */
export function calculatePaystackFees(amount: number, currency: string): {
  gateway_fee: number
  platform_fee_share: number
  seller_fee_share: number
} {
  let percentageFee = 0
  let flatFee = 0

  switch (currency) {
    case 'NGN': // Nigeria
      percentageFee = 0.015 // 1.5%
      flatFee = 100 // ₦100
      break
    case 'GHS': // Ghana
      percentageFee = 0.0195 // 1.95%
      flatFee = 0.50 // GH₵0.50
      break
    case 'ZAR': // South Africa
      percentageFee = 0.029 // 2.9%
      flatFee = 0 // No flat fee
      break
    case 'KES': // Kenya
      percentageFee = 0.035 // 3.5%
      flatFee = 0 // No flat fee
      break
    default: // International (USD, etc.)
      percentageFee = 0.039 // 3.9%
      flatFee = 0 // No flat fee
  }

  // Calculate gateway fee
  const gateway_fee = Math.round((amount * percentageFee + flatFee) * 100) / 100

  // Split fee: Platform 5%, Seller 95%
  const platform_fee_share = Math.round(gateway_fee * 0.05 * 100) / 100
  const seller_fee_share = Math.round(gateway_fee * 0.95 * 100) / 100

  return {
    gateway_fee,
    platform_fee_share,
    seller_fee_share
  }
}

export async function initializePaystackTransaction(
  amount: number,
  email: string,
  currency: string,
  metadata: Record<string, any>,
  callbackUrl?: string
): Promise<{ authorization_url: string; reference: string } | null> {
  try {
    const callback_url = callbackUrl || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/paystack/verify`

    const data = await apiClient.post<{ authorization_url: string; reference: string }>(
      '/api/marketplace/checkout/paystack/initialize',
      { amount, email, currency, metadata, callback_url }
    )

    if (!data?.authorization_url) {
      throw new Error('Invalid response from payment service')
    }

    return {
      authorization_url: data.authorization_url,
      reference: data.reference,
    }
  } catch (error) {
    console.error('Error initializing Paystack transaction:', error)
    return null
  }
}

export async function verifyPaystackTransaction(
  reference: string
): Promise<{
  success: boolean
  status: string
  amount?: number
  currency?: string
  data?: any
}> {
  try {
    const data = await apiClient.post<{
      success: boolean
      status: string
      amount?: number
      currency?: string
      data?: any
    }>('/api/marketplace/checkout/paystack/verify', { reference })

    return {
      success: data.success,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      data: data.data,
    }
  } catch (error) {
    console.error('Error verifying Paystack transaction:', error)
    return { success: false, status: 'error' }
  }
}

export async function getBanks(country: string = 'nigeria'): Promise<any[]> {
  try {
    const result = await apiClient.get<{ data: any[] }>(
      `/api/marketplace/checkout/paystack/banks?country=${encodeURIComponent(country)}`
    )
    return result.data || []
  } catch (error) {
    console.error('Error fetching banks:', error)
    return []
  }
}

export async function resolveBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<{ account_name: string; account_number: string } | null> {
  try {
    const data = await apiClient.post<{ account_name: string; account_number: string }>(
      '/api/marketplace/checkout/paystack/resolve-account',
      { account_number: accountNumber, bank_code: bankCode }
    )
    return data
  } catch (error) {
    console.error('Error resolving bank account:', error)
    return null
  }
}

export async function createTransferRecipient(
  recipientData: {
    type: 'nuban' | 'mobile_money'
    name: string
    account_number?: string
    bank_code?: string
    currency?: string
    email?: string
    phone?: string
    provider?: string
  }
): Promise<{ recipient_code: string; details: any } | null> {
  try {
    const data = await apiClient.post<{ recipient_code: string; details: any }>(
      '/api/marketplace/checkout/paystack/create-recipient',
      recipientData
    )
    return data
  } catch (error) {
    console.error('Error creating transfer recipient:', error)
    return null
  }
}

export async function createMobileMoneyRecipient(
  recipientData: {
    type: 'mobile_money'
    name: string
    phone: string
    provider: string
    currency: string
  }
): Promise<{ recipient_code: string; details: any } | null> {
  return createTransferRecipient(recipientData)
}

export async function verifyMobileMoneyAccount(
  phone: string,
  provider: string
): Promise<{
  account_name: string
  phone: string
  provider: string
  is_registered: boolean
} | null> {
  try {
    const data = await apiClient.post<{
      account_name: string
      phone: string
      provider: string
      is_registered: boolean
    }>('/api/marketplace/checkout/paystack/verify-momo', { phone, provider })
    return data
  } catch (error) {
    console.error('Error verifying mobile money account:', error)
    return null
  }
}

export async function initiateTransfer(
  transferData: {
    source: 'balance'
    amount: number
    recipient: string
    reason?: string
    reference?: string
    currency?: string
  }
): Promise<{
  transfer_code: string
  reference: string
  status: string
  details: any
} | null> {
  try {
    const data = await apiClient.post<{
      transfer_code: string
      reference: string
      status: string
      details: any
    }>('/api/marketplace/checkout/paystack/transfer', transferData)
    return data
  } catch (error) {
    console.error('Error initiating transfer:', error)
    return null
  }
}
