import { NextRequest, NextResponse } from 'next/server'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_API = 'https://api.paystack.co'

export async function POST(request: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Paystack secret key not configured' },
        { status: 500 }
      )
    }

    const data = await request.json()

    const response = await fetch(`${PAYSTACK_API}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: result.message || 'Failed to create recipient' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      recipient_code: result.data.recipient_code,
      details: result.data
    })
  } catch (error: any) {
    console.error('Error creating recipient:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

