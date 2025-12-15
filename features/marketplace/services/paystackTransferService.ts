import axios from 'axios'

const PAYSTACK_SECRET_KEY = import.meta.env.VITE_PAYSTACK_SECRET_KEY
const PAYSTACK_API = 'https://api.paystack.co'

interface RecipientData {
  type: 'nuban' // Nigerian bank account
  name: string
  account_number: string
  bank_code: string
  currency: 'NGN' | 'GHS' | 'ZAR'
}

interface TransferData {
  source: 'balance'
  amount: number // in kobo
  recipient: string // recipient code
  reason: string
  reference: string
}

/**
 * Create transfer recipient (one-time per seller)
 */
export async function createTransferRecipient(data: RecipientData) {
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
    console.error('Error creating recipient:', error.response?.data)
    throw new Error(error.response?.data?.message || 'Failed to create recipient')
  }
}

/**
 * Initiate transfer to seller
 */
export async function initiateTransfer(data: TransferData) {
  try {
    const response = await axios.post(
      `${PAYSTACK_API}/transfer`,
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
      transfer_code: response.data.data.transfer_code,
      reference: response.data.data.reference,
      status: response.data.data.status,
      details: response.data.data
    }
  } catch (error: any) {
    console.error('Error initiating transfer:', error.response?.data)
    throw new Error(error.response?.data?.message || 'Transfer failed')
  }
}

/**
 * Verify transfer status
 */
export async function verifyTransfer(reference: string) {
  try {
    const response = await axios.get(
      `${PAYSTACK_API}/transfer/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    )

    return {
      success: true,
      status: response.data.data.status,
      details: response.data.data
    }
  } catch (error: any) {
    console.error('Error verifying transfer:', error.response?.data)
    throw new Error(error.response?.data?.message || 'Verification failed')
  }
}

/**
 * Get list of supported banks
 */
export async function getBanks(country: 'nigeria' | 'ghana' | 'south-africa' = 'nigeria') {
  try {
    const response = await axios.get(
      `${PAYSTACK_API}/bank?country=${country}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    )

    return response.data.data
  } catch (error: any) {
    console.error('Error fetching banks:', error.response?.data)
    throw new Error('Failed to fetch banks')
  }
}

/**
 * Resolve account number to get account name
 */
export async function resolveAccountNumber(accountNumber: string, bankCode: string) {
  try {
    const response = await axios.get(
      `${PAYSTACK_API}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    )

    return {
      success: true,
      account_name: response.data.data.account_name,
      account_number: response.data.data.account_number
    }
  } catch (error: any) {
    console.error('Error resolving account:', error.response?.data)
    throw new Error(error.response?.data?.message || 'Account resolution failed')
  }
}
