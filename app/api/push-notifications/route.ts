import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as admin from 'firebase-admin'
import { getFirebaseAdmin } from '../fcm/_utils'
import { sendVoipApnsPush } from '@/lib/apns-voip'
import type { NotificationType } from '@/shared/types/notifications'
import { isCanonicalNotificationType } from '@/shared/types/notifications'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface NotificationPayload {
  user_id: string
  title: string
  body: string
  // Notification type for database storage
  notification_type?: NotificationType
  // Optional: skip database storage (for push-only scenarios). For type `chat_message`, DB rows are never created here — FCM only.
  skip_db?: boolean
  icon?: string
  image?: string
  badge?: string
  tag?: string
  data?: any
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
  requireInteraction?: boolean
  silent?: boolean
  vibrate?: number[]
  /** Auth session UUID (JWT `session_id`); merged into FCM `data` with optional label lookup. */
  device_session_id?: string
  /** User id that owns the row in `auth_session_device_labels` (e.g. callee who accepted/declined). */
  device_session_actor_id?: string
  /** Chat (or other) message id; merged into stored `data` and FCM `data` for deep-linking. */
  message_id?: string
  /** Optional sender profile image URL for chat notifications. */
  sender_image?: string
}

const DEFAULT_NOTIFICATION_LOGO = '/assets/images/logo.png'

function pickNonEmptyString(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return ''
}

function pickProfileImageUrl(...candidates: unknown[]): string {
  return pickNonEmptyString(...candidates)
}

async function resolveProfileAvatar(userId: string): Promise<string> {
  const normalized = userId.trim()
  if (!normalized) return ''
  const { data } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', normalized)
    .maybeSingle()
  return typeof data?.avatar_url === 'string' && data.avatar_url.trim() ? data.avatar_url.trim() : ''
}

function stringifyFcmDataValues(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string') out[k] = v
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v)
    else {
      try {
        out[k] = JSON.stringify(v)
      } catch {
        out[k] = String(v)
      }
    }
  }
  return out
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/** PushKit VoIP tokens for iOS devices (see `fcm_tokens.voip_token`). */
async function fetchActiveVoipTokensForUser(userId: string): Promise<string[]> {
  const { data: rows, error } = await supabase
    .from('fcm_tokens')
    .select('voip_token, device_id, is_active, device_type')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('voip_token', 'is', null)

  if (error || !rows?.length) return []

  const seen = new Set<string>()
  const tokens: string[] = []
  for (const row of rows as Array<{
    voip_token: string | null
    device_id: string | null
    is_active?: boolean | string
    device_type?: string | null
  }>) {
    const isActive = row.is_active === true || row.is_active === 'true'
    if (!isActive) continue
    if (row.device_type && row.device_type !== 'ios') continue
    const t = typeof row.voip_token === 'string' ? row.voip_token.trim() : ''
    if (!t) continue
    const key = `${row.device_id || t}`
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push(t)
  }
  return tokens
}

/** Call session sub-statuses that should wake iOS via PushKit VoIP (incoming ring + accept only). */
const IOS_VOIP_CALL_STATUSES = new Set(['ringing', 'active'])

/** Terminal / informational call statuses delivered via FCM only (not PushKit VoIP). */
const IOS_FCM_CALL_STATUSES = new Set(['ended', 'missed', 'declined'])

const KNOWN_CALL_EVENT_STATUSES = new Set([
  ...IOS_VOIP_CALL_STATUSES,
  ...IOS_FCM_CALL_STATUSES,
])

/** Prefer `data.type`, fall back to legacy `notification_type` sub-status (e.g. `ringing`, `missed`). */
function resolveCallEventStatus(dataType: string, rawNotificationType: string): string {
  const fromData = dataType.trim().toLowerCase()
  if (KNOWN_CALL_EVENT_STATUSES.has(fromData)) return fromData
  const fromNotification = rawNotificationType.trim().toLowerCase()
  if (KNOWN_CALL_EVENT_STATUSES.has(fromNotification)) return fromNotification
  return ''
}

/** iOS call pushes that should skip FCM to avoid duplicate CallKit / banner UI. */
const IOS_SKIP_FCM_CALL_STATUSES = IOS_VOIP_CALL_STATUSES

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    console.log('📱 Push notification API called')

    const body = await request.json() as NotificationPayload
    console.log('✅ Notification payload:', body)
    const { user_id, title, body: notificationBody, notification_type, skip_db } = body

    if (!user_id || !title || !notificationBody) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields: user_id, title, and body are required' 
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    const normalizeIncomingType = (raw: unknown, embeddedRaw: unknown): NotificationType | null => {
      const candidate = (typeof raw === 'string' && raw.trim()) || (typeof embeddedRaw === 'string' && embeddedRaw.trim()) || ''
      if (!candidate) return null

      // Canonical types (your requested list)
      if (isCanonicalNotificationType(candidate)) return candidate

      // Legacy mappings → canonical
      switch (candidate) {
        case 'like':
          return 'post_like'
        case 'comment':
          return 'post_comment'
        case 'comment_like':
          return 'post_comment_like'
        case 'friend_request_confirmed':
          return 'friend_request_accepted'
        case 'initiated':
        case 'ringing':
        case 'active':
        case 'ended':
        case 'declined':
        case 'missed':
        case 'failed':
        case 'switched_to_video':
        case 'switched_to_audio':
        case 'video_requested':
        case 'video_accepted':
        case 'video_declined':
        case 'participant_joined':
        case 'participant_left':
        case 'participant_declined':
        case 'participant_missed':
          return 'call'
        default:
          return null
      }
    }

    const embeddedType = body?.data && typeof body.data === 'object' ? (body.data as any)?.type : undefined
    const canonicalType = normalizeIncomingType(notification_type, embeddedType)

    if (!canonicalType) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid notification_type. Allowed types: ' +
            [
              'new_order',
              'post_like',
              'post_comment',
              'post_comment_like',
              'post_create',
              'post_share',
              'post_reaction',
              'reel_like',
              'reel_comment',
              'reel_create',
              'reel_share',
              'reel_comment_like',
              'follow',
              'unfollow',
              'mention',
              'friend_request',
              'friend_request_accepted',
              'friend_request_declined',
              'chat_message',
              'call',
              'birthday',
            ].join(', '),
        },
        { status: 400, headers: corsHeaders }
      )
    }

    const rawPushData: Record<string, unknown> =
      body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? { ...(body.data as Record<string, unknown>) }
        : {}

    let profileImage = pickProfileImageUrl(
      body.sender_image,
      body.image,
      rawPushData.sender_image,
      rawPushData.caller_avatar_url,
      rawPushData.actor_avatar,
      rawPushData.avatar_url,
    )

    if (!profileImage && canonicalType === 'call') {
      const actorId = pickNonEmptyString(
        rawPushData.caller_id,
        rawPushData.sender_id,
        rawPushData.actor_id,
      )
      if (actorId) {
        profileImage = await resolveProfileAvatar(actorId)
      }
    }

    if (profileImage) {
      if (!rawPushData.sender_image) rawPushData.sender_image = profileImage
      if (!rawPushData.caller_avatar_url) rawPushData.caller_avatar_url = profileImage
      if (!rawPushData.actor_avatar) rawPushData.actor_avatar = profileImage
    }

    const notificationIcon =
      pickProfileImageUrl(body.icon) && body.icon !== DEFAULT_NOTIFICATION_LOGO
        ? pickProfileImageUrl(body.icon)
        : profileImage || DEFAULT_NOTIFICATION_LOGO

    const messageId =
      typeof body.message_id === 'string' && body.message_id.trim()
        ? body.message_id.trim()
        : ''
    if (messageId) rawPushData.message_id = messageId

    const deviceSessionId =
      typeof body.device_session_id === 'string' && body.device_session_id.trim()
        ? body.device_session_id.trim()
        : ''
    const deviceSessionActorId =
      typeof body.device_session_actor_id === 'string' && body.device_session_actor_id.trim()
        ? body.device_session_actor_id.trim()
        : ''

    if (deviceSessionId && deviceSessionActorId) {
      rawPushData.device_session_id = deviceSessionId
      const { data: labelRow } = await supabase
        .from('auth_session_device_labels')
        .select('device_label')
        .eq('user_id', deviceSessionActorId)
        .eq('session_id', deviceSessionId)
        .maybeSingle()
      const rawLabel =
        labelRow &&
        typeof labelRow === 'object' &&
        'device_label' in labelRow &&
        typeof (labelRow as { device_label: unknown }).device_label === 'string'
          ? (labelRow as { device_label: string }).device_label.trim()
          : ''
      if (rawLabel) rawPushData.device_session_label = rawLabel
    }

    const fcmStringData = stringifyFcmDataValues(rawPushData)

    // Call events on iOS: VoIP for ring/accept only; ended/missed/declined go through FCM.
    const callRingDataType =
      rawPushData.type != null ? String(rawPushData.type).trim().toLowerCase() : ''
    const callRingNotificationType =
      typeof notification_type === 'string' ? notification_type.trim().toLowerCase() : ''
    const callEventStatus = resolveCallEventStatus(callRingDataType, callRingNotificationType)
    const sendIosVoipForCall = canonicalType === 'call' && IOS_VOIP_CALL_STATUSES.has(callEventStatus)
    const skipIosFcmForVoipCall =
      canonicalType === 'call' && IOS_SKIP_FCM_CALL_STATUSES.has(callEventStatus)

    // Birthday reminders: at most one per friend per day per "when" (today vs tomorrow) for this user.
    if (canonicalType === 'birthday' && !skip_db) {
      const dedupeKey =
        rawPushData &&
        typeof (rawPushData as { birthday_dedupe_key?: unknown }).birthday_dedupe_key === 'string'
          ? String((rawPushData as { birthday_dedupe_key: string }).birthday_dedupe_key).trim()
          : ''
      if (dedupeKey) {
        const { data: existingBirthday } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user_id)
          .eq('type', 'birthday')
          .contains('data', { birthday_dedupe_key: dedupeKey })
          .maybeSingle()

        if (existingBirthday?.id) {
          return NextResponse.json(
            {
              success: true,
              duplicate: true,
              message: 'Birthday notification already sent for this day',
              notification_id: existingBirthday.id,
              sent: 0,
              failed: 0,
              total: 0,
              results: [],
            },
            { headers: corsHeaders }
          )
        }
      }
    }

    
    const persistToDb =
      !skip_db && canonicalType !== 'chat_message' && canonicalType !== 'call'

    let notificationId: string | null = null
    if (persistToDb) {
      const { data: notification, error: dbError } = await supabase
        .from('notifications')
        .insert({
          user_id,
          type: canonicalType,
          title,
          message: notificationBody,
          data: { ...rawPushData, type: canonicalType },
          is_read: false
        })
        .select('id')
        .single()

      if (dbError) {
        console.error('❌ Error creating notification in database:', dbError)
        // Continue with push notification even if DB insert fails
      } else {
        notificationId = notification?.id
        console.log('✅ Notification created in database:', notificationId)
      }
    }
    // Fetch active FCM tokens from database
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('fcm_tokens')
      .select('fcm_token, device_type, device_id, is_active')
      .eq('user_id', user_id)
      .eq('is_active', true)

    if (subscriptionError) {
      console.error('❌ Error fetching subscriptions:', subscriptionError)
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to fetch push subscriptions',
          sent: 0,
          failed: 0,
          total: 0,
          results: []
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      )
    }

    // Safety gate: send only for active tokens (supports boolean and string values).
    const activeSubscriptions = (subscriptions || []).filter((sub) => {
      const isActive = sub.is_active === true || sub.is_active === 'true'
      return isActive && !!sub.fcm_token
    })

    if (activeSubscriptions.length === 0 && !sendIosVoipForCall) {
      return NextResponse.json(
        {
          success: notificationId !== null, // Success if notification was stored in DB
          notification_id: notificationId,
          message: 'No active push subscriptions found for this user',
          sent: 0,
          failed: 0,
          total: 0,
          results: []
        },
        {
          status: 200, // Return 200 even if no tokens found (not an error)
          headers: corsHeaders,
        }
      )
    }

    const firebaseAdmin = getFirebaseAdmin()
    if (!firebaseAdmin && activeSubscriptions.length > 0) {
      console.warn('⚠️ Firebase Admin SDK not initialized; FCM delivery skipped')
    }

    // Deduplicate by device_id so we send at most one notification per device (avoids duplicate toasts)
    const byDevice = new Map<string, (typeof activeSubscriptions)[0]>()
    for (const sub of activeSubscriptions) {
      const key = `${sub.device_id || sub.fcm_token}`
      if (!byDevice.has(key)) byDevice.set(key, sub)
    }
    const subscriptionsToSend = Array.from(byDevice.values())

    // Prepare base FCM message payload
    const baseMessage: Omit<admin.messaging.Message, 'token' | 'topic' | 'condition'> = {
      data: {
        ...fcmStringData,
        title: body.title,
        body: notificationBody,
        // Use sender/caller profile image as icon when available (chat, missed call, etc.)
        icon: notificationIcon,
        badge: body.badge || DEFAULT_NOTIFICATION_LOGO,
        tag: body.tag || 'connectafrik-notification',
        requireInteraction: String(body.requireInteraction || false),
        silent: String(body.silent || false),
        vibrate: JSON.stringify(body.vibrate || [200, 100, 200]),
        timestamp: String(Date.now()),
        // Actions are determined by the service worker based on notification type.
        // For type ringing: SW shows Answer/Decline. For missed: SW shows no actions.
        // Pass through any explicit actions, or let the SW decide based on type.
        actions: JSON.stringify(body.actions || []),
      },
      
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: body.silent ? undefined : 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    }

    const sendPromises =
      firebaseAdmin && subscriptionsToSend.length > 0
        ? subscriptionsToSend.map(async (subscription) => {
      try {
        const fcmToken = subscription.fcm_token

        if (subscription.device_type === 'ios' && skipIosFcmForVoipCall) {
          const skipReason = `skipped-ios-call-${callEventStatus || 'event'}-voip`
          console.log(`Skipping FCM for iOS call push (${skipReason})`)
          return {
            success: true,
            skipped: true,
            endpoint: subscription.device_id || fcmToken.substring(0, 50),
            device_type: subscription.device_type,
            messageId: skipReason,
          }
        }

        const isIosChatMessage =
          subscription.device_type === 'ios' && canonicalType === 'chat_message'

        // Create complete message with token
        const iosOnlyMessageOverrides: Partial<admin.messaging.Message> =
          subscription.device_type === 'ios'
            ? {
                notification: {
                  title: body.title,
                  body: notificationBody,
                },
                apns: {
                  headers: isIosChatMessage
                    ? {
                        'apns-push-type': 'alert',
                        'apns-priority': '10',
                      }
                    : undefined,
                  payload: {
                    aps: {
                      alert: {
                        title: body.title,
                        body: notificationBody,
                      },
                      sound: body.silent ? undefined : 'default',
                      badge: 1,
                      contentAvailable: true,
                    },
                  },
                },
              }
            : {}

        const fcmMessage: admin.messaging.Message = {
          ...baseMessage,
          ...iosOnlyMessageOverrides,
          token: fcmToken,
        }

        const response = await admin.messaging(firebaseAdmin).send(fcmMessage)
        
        console.log(`✅ djs FCM notification sent successfully to ${subscription.device_type} device: ${response}`)
        return { 
          success: true, 
          endpoint: subscription.device_id || fcmToken.substring(0, 50), 
          device_type: subscription.device_type,
          messageId: response 
        }
      } catch (error: any) {
        console.error('Error sending FCM notification:', error)
        
        // Handle invalid token errors - mark as inactive
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          console.log(`Deactivating invalid FCM token: ${subscription.fcm_token}`)
          await supabase
            .from('fcm_tokens')
            .update({
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .eq('fcm_token', subscription.fcm_token)
            .eq('user_id', user_id)
        }
        
        return { 
          success: false, 
          endpoint: subscription.device_id || subscription.fcm_token?.substring(0, 50) || 'unknown', 
          device_type: subscription.device_type,
          error: error.message || error.code 
        }
      }
    })
        : []

    const fcmResults = sendPromises.length > 0 ? await Promise.all(sendPromises) : []

    let voipResults: Array<{
      success: boolean
      endpoint: string
      device_type: string
      messageId?: string
      error?: string
    }> = []

    if (sendIosVoipForCall) {
      const voipTokens = await fetchActiveVoipTokensForUser(user_id)
      const voipData: Record<string, string> = {
        ...fcmStringData,
        title: body.title,
        body: notificationBody,
        type: callEventStatus,
      }

      if (voipTokens.length === 0) {
        console.warn('No active iOS VoIP tokens for call push', {
          user_id,
          call_status: callEventStatus,
        })
      }

      voipResults = await Promise.all(
        voipTokens.map(async (voipToken) => {
          const endpoint = voipToken.substring(0, 12)
          try {
            await sendVoipApnsPush({
              token: voipToken,
              title: body.title,
              body: notificationBody,
              data: voipData,
            })
            console.log(`✅ APNs VoIP call push sent (${callEventStatus})`)
            return {
              success: true,
              endpoint,
              device_type: 'ios-voip',
              messageId: `voip-${callEventStatus}`,
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('APNs VoIP call push failed', {
              user_id,
              call_status: callEventStatus,
              error: message,
            })
            return {
              success: false,
              endpoint,
              device_type: 'ios-voip',
              error: message,
            }
          }
        })
      )
    }

    const results = [...fcmResults, ...voipResults]
    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    const total = subscriptionsToSend.length + voipResults.length

    return NextResponse.json(
      {
        success: successful > 0 || notificationId !== null,
        notification_id: notificationId,
        sent: successful,
        failed,
        total,
        results
      },
      {
        headers: corsHeaders,
      }
    )
  } catch (error) {
    console.error('❌ Error in push notification API:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}


