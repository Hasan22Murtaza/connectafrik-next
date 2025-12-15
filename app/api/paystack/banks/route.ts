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
    const country = searchParams.get('country') || 'nigeria'

    const response = await fetch(
      `${PAYSTACK_API}/bank?country=${encodeURIComponent(country)}`,
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
        { error: result.message || 'Failed to fetch banks' },
        { status: response.status }
      )
    }

    return NextResponse.json(result.data)
  } catch (error: any) {
    console.error('Error fetching banks:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

