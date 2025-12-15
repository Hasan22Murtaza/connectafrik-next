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
    const phone = searchParams.get('phone')
    const provider = searchParams.get('provider')

    if (!phone || !provider) {
      return NextResponse.json(
        { error: 'Missing phone or provider parameter' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${PAYSTACK_API}/bank/resolve_mobile_money?phone=${encodeURIComponent(phone)}&provider=${encodeURIComponent(provider)}`,
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
        { error: result.message || 'Account verification failed' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      account_name: result.data.account_name,
      phone: result.data.phone,
      provider: result.data.provider,
      is_registered: result.data.is_registered
    })
  } catch (error: any) {
    console.error('Error verifying mobile money account:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

