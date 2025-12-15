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
    const reference = searchParams.get('reference')

    if (!reference) {
      return NextResponse.json(
        { error: 'Missing reference parameter' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${PAYSTACK_API}/transfer/verify/${encodeURIComponent(reference)}`,
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
        { error: result.message || 'Verification failed' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      status: result.data.status,
      details: result.data
    })
  } catch (error: any) {
    console.error('Error verifying transfer:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

