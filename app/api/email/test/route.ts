import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/shared/services/emailService'

/** POST /api/email/test — send a simple SES test (e.g. Postman). No auth. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, htmlBody, textBody } = body as {
      to?: string
      subject?: string
      htmlBody?: string
      textBody?: string
    }

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return NextResponse.json(
        { error: 'Body must include "to" (recipient email string)' },
        { status: 400 }
      )
    }

    const ok = await sendEmail({
      to: to.trim(),
      subject: typeof subject === 'string' && subject.trim() ? subject.trim() : 'ConnectAfrik email test',
      htmlBody:
        typeof htmlBody === 'string' && htmlBody.trim()
          ? htmlBody.trim()
          : '<p>ConnectAfrik SES test email.</p>',
      textBody:
        typeof textBody === 'string' && textBody.trim()
          ? textBody.trim()
          : 'ConnectAfrik SES test email.',
    })

    if (ok) {
      return NextResponse.json({ success: true, to: to.trim() })
    }

    return NextResponse.json(
      { error: 'Failed to send; check server logs and SES configuration' },
      { status: 500 }
    )
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error'
    console.error('POST /api/email/test:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
