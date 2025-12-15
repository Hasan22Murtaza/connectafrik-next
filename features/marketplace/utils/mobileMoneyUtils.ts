export interface MobileMoneyProvider {
  code: string
  name: string
  country: string
  currency: string
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

