import { NextRequest, NextResponse } from 'next/server'
import { sendNewOrderNotificationEmail } from '@/shared/services/emailService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sellerEmail, orderDetails } = body

    if (!sellerEmail || !orderDetails) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const result = await sendNewOrderNotificationEmail(sellerEmail, orderDetails)

    if (result) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error sending order notification email:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

