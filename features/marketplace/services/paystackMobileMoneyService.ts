import axios from 'axios'

const PAYSTACK_SECRET_KEY = import.meta.env.VITE_PAYSTACK_SECRET_KEY
const PAYSTACK_API = 'https://api.paystack.co'

export interface MobileMoneyProvider {
  code: string
  name: string
  country: string
  currency: string
}

export interface MobileMoneyCharge {
  email: string
  amount: number // in kobo/pesewas/cents
  currency: string
  mobile_money: {
    phone: string
    provider: string
  }
  metadata?: Record<string, any>
}

export interface MobileMoneyRecipient {
  type: 'mobile_money'
  name: string
  phone: string
  currency: string
  provider_code: string
}

/**
 * Get available mobile money providers by country
 */
export function getMobileMoneyProviders(country?: string): MobileMoneyProvider[] {
  const allProviders: MobileMoneyProvider[] = [
    // Ghana
    { code: 'mtn-gh', name: 'MTN Mobile Money', country: 'GH', currency: 'GHS' },
    { code: 'vod-gh', name: 'Vodafone Cash', country: 'GH', currency: 'GHS' },
    { code: 'tgo-gh', name: 'AirtelTigo Money', country: 'GH', currency: 'GHS' },

    // Kenya
    { code: 'mpesa', name: 'M-Pesa', country: 'KE', currency: 'KES' },
    { code: 'airtel-ke', name: 'Airtel Money', country: 'KE', currency: 'KES' },

    // Rwanda
    { code: 'mtn-rw', name: 'MTN Mobile Money', country: 'RW', currency: 'RWF' },
    { code: 'airtel-rw', name: 'Airtel Money', country: 'RW', currency: 'RWF' },

    // Uganda
    { code: 'mtn-ug', name: 'MTN Mobile Money', country: 'UG', currency: 'UGX' },
    { code: 'airtel-ug', name: 'Airtel Money', country: 'UG', currency: 'UGX' },

    // Zambia
    { code: 'mtn-zm', name: 'MTN Mobile Money', country: 'ZM', currency: 'ZMW' },
    { code: 'airtel-zm', name: 'Airtel Money', country: 'ZM', currency: 'ZMW' },

    // Ivory Coast
    { code: 'mtn-ci', name: 'MTN Mobile Money', country: 'CI', currency: 'XOF' },
    { code: 'orange-ci', name: 'Orange Money', country: 'CI', currency: 'XOF' },
    { code: 'moov-ci', name: 'Moov Money', country: 'CI', currency: 'XOF' }
  ]

  if (country) {
    return allProviders.filter(p => p.country === country.toUpperCase())
  }

  return allProviders
}

/**
 * Detect provider from phone number prefix
 */
export function detectProviderFromPhone(phone: string, country: string): string | null {
  const cleanPhone = phone.replace(/\D/g, '') // Remove non-digits

  // Ghana prefixes
  if (country === 'GH') {
    if (cleanPhone.startsWith('233') || cleanPhone.startsWith('0')) {
      const prefix = cleanPhone.slice(-9, -7) // Get first 2 digits of 9-digit number
      if (['24', '54', '55', '59'].includes(prefix)) return 'mtn-gh'
      if (['20', '50'].includes(prefix)) return 'vod-gh'
      if (['26', '56', '57'].includes(prefix)) return 'tgo-gh'
    }
  }

  // Kenya prefixes
  if (country === 'KE') {
    if (cleanPhone.startsWith('254') || cleanPhone.startsWith('0')) {
      const prefix = cleanPhone.slice(-9, -7)
      if (['70', '71', '72', '79'].includes(prefix)) return 'mpesa'
      if (['73', '78'].includes(prefix)) return 'airtel-ke'
    }
  }

  return null
}

/**
 * Initiate mobile money payment charge
 */
export async function chargeMobileMoney(data: MobileMoneyCharge) {
  try {
    const response = await axios.post(
      `${PAYSTACK_API}/charge`,
      data,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    return {
      success: true,
      reference: response.data.data.reference,
      status: response.data.data.status,
      display_text: response.data.data.display_text,
      data: response.data.data
    }
  } catch (error: any) {
    console.error('Error charging mobile money:', error.response?.data)
    throw new Error(error.response?.data?.message || 'Mobile money charge failed')
  }
}

/**
 * Verify mobile money account (check if phone is registered)
 */
export async function verifyMobileMoneyAccount(phone: string, providerCode: string) {
  try {
    const response = await axios.get(
      `${PAYSTACK_API}/bank/resolve_mobile_money`,
      {
        params: {
          phone: phone,
          provider: providerCode
        },
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    )

    return {
      success: true,
      account_name: response.data.data.account_name,
      phone: response.data.data.phone,
      provider: response.data.data.provider,
      is_registered: response.data.data.is_registered
    }
  } catch (error: any) {
    console.error('Error verifying mobile money account:', error.response?.data)
    throw new Error(error.response?.data?.message || 'Account verification failed')
  }
}

/**
 * Create mobile money transfer recipient
 */
export async function createMobileMoneyRecipient(data: MobileMoneyRecipient) {
  try {
    const response = await axios.post(
      `${PAYSTACK_API}/transferrecipient`,
      data,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    return {
      success: true,
      recipient_code: response.data.data.recipient_code,
      details: response.data.data
    }
  } catch (error: any) {
    console.error('Error creating mobile money recipient:', error.response?.data)
    throw new Error(error.response?.data?.message || 'Failed to create recipient')
  }
}

/**
 * Format phone number for Paystack
 */
export function formatPhoneForPaystack(phone: string, countryCode: string): string {
  let cleanPhone = phone.replace(/\D/g, '')

  // Country code mappings
  const countryCodes: Record<string, string> = {
    'GH': '233',
    'KE': '254',
    'RW': '250',
    'UG': '256',
    'ZM': '260',
    'CI': '225'
  }

  const code = countryCodes[countryCode.toUpperCase()]

  if (!code) {
    throw new Error(`Unsupported country code: ${countryCode}`)
  }

  // Remove leading zero if present
  if (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.slice(1)
  }

  // Remove country code if already present
  if (cleanPhone.startsWith(code)) {
    cleanPhone = cleanPhone.slice(code.length)
  }

  // Return with country code
  return `${code}${cleanPhone}`
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string, country: string): { valid: boolean; message?: string } {
  const cleanPhone = phone.replace(/\D/g, '')

  // Country-specific validations
  const validations: Record<string, { length: number; name: string }> = {
    'GH': { length: 10, name: 'Ghana' }, // 0XXXXXXXXX
    'KE': { length: 10, name: 'Kenya' }, // 0XXXXXXXXX
    'RW': { length: 10, name: 'Rwanda' },
    'UG': { length: 10, name: 'Uganda' },
    'ZM': { length: 10, name: 'Zambia' },
    'CI': { length: 10, name: 'Ivory Coast' }
  }

  const validation = validations[country.toUpperCase()]

  if (!validation) {
    return { valid: false, message: `Unsupported country: ${country}` }
  }

  // Check if starts with 0 and has correct length
  if (cleanPhone.startsWith('0') && cleanPhone.length === validation.length) {
    return { valid: true }
  }

  // Check if has country code and correct total length
  if (cleanPhone.length === validation.length - 1 || cleanPhone.length === validation.length + 3) {
    return { valid: true }
  }

  return {
    valid: false,
    message: `Invalid ${validation.name} phone number. Expected format: 0XXXXXXXXX (10 digits)`
  }
}
