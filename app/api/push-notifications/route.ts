import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as admin from 'firebase-admin'
import { getFirebaseAdmin } from '../fcm/_utils'
import type { NotificationType } from '@/shared/types/notifications'

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
  // Optional: skip database storage (for push-only scenarios)
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
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    console.log('📱 Push notification API called')

    const body = await request.json() as NotificationPayload
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

    // Step 1: Create notification record in database (unless skip_db is true)
    let notificationId: string | null = null
    if (!skip_db) {
      const { data: notification, error: dbError } = await supabase
        .from('notifications')
        .insert({
          user_id,
          type: notification_type || 'system',
          title,
          message: notificationBody,
          data: body.data || {},
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

    // Step 2: Send FCM push notification
    const firebaseAdmin = getFirebaseAdmin()
    if (!firebaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: 'Firebase Admin SDK not initialized',
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

    // Fetch active FCM tokens from database
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('fcm_tokens')
      .select('fcm_token, device_type, device_id')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .not('fcm_token', 'is', null)

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

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        {
          success: notificationId !== null, // Success if notification was stored in DB
          notification_id: notificationId,
          message: 'No push subscriptions found for this user',
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

    // Deduplicate by device_id so we send at most one notification per device (avoids duplicate toasts)
    const byDevice = new Map<string, (typeof subscriptions)[0]>()
    for (const sub of subscriptions) {
      const key = sub.device_id || sub.fcm_token
      if (!byDevice.has(key)) byDevice.set(key, sub)
    }
    const subscriptionsToSend = Array.from(byDevice.values())

    // Prepare base FCM message payload
    const baseMessage: Omit<admin.messaging.Message, 'token' | 'topic' | 'condition'> = {

      data: {
        ...(body.data || {}),
        title: body.title,
        body: notificationBody,
        ...(body.image && { image: body.image }),
        icon: body.icon || '/assets/images/logo.png',
        badge: body.badge || '/assets/images/logo.png',
        tag: body.tag || 'connectafrik-notification',
        requireInteraction: String(body.requireInteraction || false),
        silent: String(body.silent || false),
        vibrate: JSON.stringify(body.vibrate || [200, 100, 200]),
        timestamp: String(Date.now()),
        actions: JSON.stringify(body.actions || [
          {
            action: 'view',
            title: 'View',
            icon: '/icons/view.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/icons/dismiss.png'
          }
        ]),
      },

      apns: {
        payload: {
          aps: {
            sound: body.silent ? undefined : 'default',
            badge: 1,
          },
        },
      },
    }

    const sendPromises = subscriptionsToSend.map(async (subscription) => {
      try {
        const fcmToken = subscription.fcm_token
        
        if (!fcmToken) {
          return { 
            success: false, 
            endpoint: subscription.device_id || 'unknown', 
            error: 'FCM token not found' 
          }
        }

        // Create complete message with token
        const fcmMessage: admin.messaging.Message = {
          ...baseMessage,
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

    const results = await Promise.all(sendPromises)
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json(
      {
        success: successful > 0 || notificationId !== null,
        notification_id: notificationId,
        sent: successful,
        failed,
        total: subscriptionsToSend.length,
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


