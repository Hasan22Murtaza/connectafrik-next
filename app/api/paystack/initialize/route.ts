import { NextRequest, NextResponse } from 'next/server'

// Prefer server-side secret. For local/dev only, allow a temporary fallback
// from NEXT_PUBLIC_PAYSTACK_SECRET_KEY when PAYSTACK_SECRET_KEY isn't set.
// WARNING: Using a public env var for the secret is insecure — do NOT use in production.
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || process.env.NEXT_PUBLIC_PAYSTACK_SECRET_KEY
const PAYSTACK_API = 'https://api.paystack.co'

export async function POST(request: NextRequest) {
    try {
        if (!PAYSTACK_SECRET_KEY) {
            return NextResponse.json({ error: 'Paystack secret key not configured' }, { status: 500 })
        }

        if (!process.env.PAYSTACK_SECRET_KEY && process.env.NEXT_PUBLIC_PAYSTACK_SECRET_KEY) {
            console.warn('Using NEXT_PUBLIC_PAYSTACK_SECRET_KEY as a temporary fallback for Paystack secret. Do not use in production.')
        }

        const body = await request.json()
        const { amount, email, currency, metadata } = body

        if (!amount || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const callback_url = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/paystack/verify`

        const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount, email, currency, metadata, callback_url })
        })

        const result = await response.json()

        if (!response.ok) {
            return NextResponse.json({ error: result.message || 'Paystack initialize failed', data: result }, { status: response.status })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error initializing Paystack transaction:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
