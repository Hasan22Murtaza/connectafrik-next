import { NextRequest, NextResponse } from 'next/server'
import { sendPaymentStatusEmail } from '@/shared/services/emailService'
import type { PaymentStatus } from '@/lib/emails/paymentStatusEmail'

const STATUSES: PaymentStatus[] = ['successful', 'failed', 'pending']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { buyerEmail, status, paymentDetails } = body as {
      buyerEmail?: string
      status?: string
      paymentDetails?: {
        buyerName: string
        amount: number
        currency: string
        productTitle?: string | null
        orderNumber?: string | null
        orderId?: string | null
      }
    }

    if (!buyerEmail || !paymentDetails || !status || !STATUSES.includes(status as PaymentStatus)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await sendPaymentStatusEmail(
      buyerEmail,
      status as PaymentStatus,
      paymentDetails
    )

    if (result) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error sending payment status email:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
