import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createNotification } from '@/lib/notifications/createNotification'
import { sendNewLoginAlertEmail } from '@/shared/services/emailService'
import { deviceLabelFromUserAgent } from '@/shared/utils/sessionDeviceLabel'

function requestIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
}

export async function maybeSendLoginAlert(params: {
  serviceClient: SupabaseClient
  userId: string
  email?: string | null
  request: NextRequest
}): Promise<void> {
  const { serviceClient, userId, email, request } = params

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('login_alerts, full_name, first_name, username')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.login_alerts === false) return

  const userName =
    profile?.full_name ||
    profile?.first_name ||
    profile?.username ||
    email?.split('@')[0] ||
    'there'
  const deviceLabel = deviceLabelFromUserAgent(request.headers.get('user-agent'))
  const ip = requestIp(request)
  const timeLabel = new Date().toUTCString()

  if (email?.includes('@')) {
    sendNewLoginAlertEmail(email, {
      userName,
      deviceLabel,
      ip,
      timeLabel,
    }).catch(() => {})
  }

  try {
    await createNotification({
      user_id: userId,
      type: 'system',
      title: 'New sign-in',
      message: `New sign-in from ${deviceLabel}${ip ? ` (${ip})` : ''}`,
      data: {
        type: 'login_alert',
        device_label: deviceLabel,
        ip,
      },
    })
  } catch {
    /* in-app alert is best-effort */
  }
}
