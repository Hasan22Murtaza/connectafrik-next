import { supabase } from '@/lib/supabase'

// Supabase Edge Function URL for Paystack operations
const SUPABASE_FUNCTION_URL = 'https://jsggugavfanjrqdjsxbt.supabase.co/functions/v1'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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

/**
 * Helper function to call Supabase Edge Functions
 */
async function invokeSupabaseFunction(
  functionName: string,
  body: any,
  method: 'GET' | 'POST' = 'POST'
): Promise<any> {
  try {
    const authKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY
    if (!authKey) {
      throw new Error('Supabase authentication key not configured')
    }

    const url = new URL(`${SUPABASE_FUNCTION_URL}/${functionName}`)
    
    // For GET requests, add params to URL
    if (method === 'GET' && body) {
      Object.keys(body).forEach(key => {
        url.searchParams.append(key, body[key])
      })
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${authKey}`,
        'Content-Type': 'application/json'
      }
    }

    // Only add body for POST requests
    if (method === 'POST' && body) {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url.toString(), fetchOptions)

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText, status: response.status, statusText: response.statusText }
      }
      throw new Error(errorData.message || errorData.error || `${functionName} failed (${response.status}: ${response.statusText})`)
    }

    const result = await response.json()
    return result
  } catch (error: any) {
    console.error(`Error calling ${functionName}:`, error)
    throw error
  }
}

/**
 * Initialize Paystack payment transaction
 * Note: Secret key is stored securely in Supabase Edge Functions
 */
export async function initializePaystackTransaction(
  amount: number,
  email: string,
  currency: string,
  metadata: Record<string, any>,
  callbackUrl?: string
): Promise<{ authorization_url: string; reference: string } | null> {
  try {
    const callback_url = callbackUrl || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/paystack/verify`

    const result = await invokeSupabaseFunction('paystack-init', {
      amount: Math.round(amount * 100), // Convert to kobo/cents
      email,
      currency,
      metadata,
      callback_url: callback_url
    })

    // Handle response structure: can be direct or wrapped in data property
    const responseData = result.data || result

    if (!responseData || !responseData.authorization_url) {
      console.error('Invalid response from paystack-init:', result)
      throw new Error('Invalid response from payment service')
    }

    return {
      authorization_url: responseData.authorization_url,
      reference: responseData.reference
    }
  } catch (error) {
    console.error('Error initializing Paystack transaction:', error)
    return null
  }
}

/**
 * Verify Paystack payment transaction
 */
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
    // Try GET first for verification (read operation)
    // If that fails, the function might require POST
    let result
    try {
      result = await invokeSupabaseFunction('paystack-verify', {
        reference
      }, 'GET')
    } catch (getError: any) {
      // If GET fails with method not allowed, try POST
      if (getError.message?.includes('Method not allowed') || getError.message?.includes('405')) {
        result = await invokeSupabaseFunction('paystack-verify', {
          reference
        }, 'POST')
      } else {
        throw getError
      }
    }

    // Handle response structure: can be direct or wrapped in data property
    const responseData = result.data || result
    return {
      success: responseData?.status === 'success',
      status: responseData?.status || 'unknown',
      amount: responseData?.amount ? responseData.amount / 100 : undefined,
      currency: responseData?.currency?.toUpperCase(),
      data: responseData
    }
  } catch (error) {
    console.error('Error verifying Paystack transaction:', error)
    return { success: false, status: 'error' }
  }
}

/**
 * Get list of banks for a country
 */
export async function getBanks(country: string = 'nigeria'): Promise<any[]> {
  try {
    const result = await invokeSupabaseFunction('paystack-banks', {
      country
    })

    return result.data || []
  } catch (error) {
    console.error('Error fetching banks:', error)
    return []
  }
}

/**
 * Resolve bank account details
 */
export async function resolveBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<{ account_name: string; account_number: string } | null> {
  try {
    const result = await invokeSupabaseFunction('paystack-resolve-account', {
      account_number: accountNumber,
      bank_code: bankCode
    })

    if (!result.data) {
      return null
    }

    return {
      account_name: result.data.account_name,
      account_number: result.data.account_number
    }
  } catch (error) {
    console.error('Error resolving bank account:', error)
    return null
  }
}

/**
 * Create transfer recipient (for bank transfers)
 */
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
    const result = await invokeSupabaseFunction('paystack-create-recipient', {
      ...recipientData
    })

    if (!result.data || !result.data.recipient_code) {
      return null
    }

    return {
      recipient_code: result.data.recipient_code,
      details: result.data
    }
  } catch (error) {
    console.error('Error creating transfer recipient:', error)
    return null
  }
}

/**
 * Create mobile money recipient
 */
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

/**
 * Verify mobile money account
 */
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
    const result = await invokeSupabaseFunction('paystack-verify-momo', {
      phone,
      provider
    })

    if (!result.data) {
      return null
    }

    return {
      account_name: result.data.account_name,
      phone: result.data.phone,
      provider: result.data.provider,
      is_registered: result.data.is_registered
    }
  } catch (error) {
    console.error('Error verifying mobile money account:', error)
    return null
  }
}

/**
 * Initiate transfer to recipient
 */
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
    const result = await invokeSupabaseFunction('paystack-transfer', {
      ...transferData,
      amount: Math.round(transferData.amount * 100) // Convert to kobo/cents
    })

    if (!result.data) {
      return null
    }

    return {
      transfer_code: result.data.transfer_code,
      reference: result.data.reference,
      status: result.data.status,
      details: result.data
    }
  } catch (error) {
    console.error('Error initiating transfer:', error)
    return null
  }
}
