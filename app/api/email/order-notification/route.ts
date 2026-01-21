import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendNewOrderNotificationEmail } from '@/shared/services/emailService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sellerId, sellerEmail, orderDetails } = body

    // Support both sellerId (preferred) and sellerEmail (backward compatibility)
    let emailToUse = sellerEmail

    // If sellerId is provided, fetch the email from auth.users
    if (sellerId && !emailToUse) {
      try {
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(sellerId)
        if (!authError && authUser?.user?.email) {
          emailToUse = authUser.user.email
        } else {
          console.warn('Could not fetch seller email from auth.users:', authError)
        }
      } catch (err) {
        console.error('Error fetching seller email:', err)
      }
    }

    if (!emailToUse || !orderDetails) {
      return NextResponse.json(
        { error: 'Missing required fields: sellerId or sellerEmail, and orderDetails' },
        { status: 400 }
      )
    }

    const result = await sendNewOrderNotificationEmail(emailToUse, orderDetails)

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

