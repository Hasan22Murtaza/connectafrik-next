import { NextRequest, NextResponse } from 'next/server'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_API = 'https://api.paystack.co'

export async function GET(request: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Paystack secret key not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const accountNumber = searchParams.get('account_number')
    const bankCode = searchParams.get('bank_code')

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { error: 'Missing account_number or bank_code parameter' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${PAYSTACK_API}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    )

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: result.message || 'Account resolution failed' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      account_name: result.data.account_name,
      account_number: result.data.account_number
    })
  } catch (error: any) {
    console.error('Error resolving account:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

