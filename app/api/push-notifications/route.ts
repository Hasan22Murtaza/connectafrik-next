import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Configure VAPID details for web push
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@connectafrik.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

export interface NotificationPayload {
  user_id: string
  title: string
  body: string
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

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    console.log('📱 Push notification API called')

    const body = await request.json() as NotificationPayload
    const { user_id, title, body: notificationBody, icon, image, badge, tag, data, actions, requireInteraction, silent, vibrate } = body

    // Validate required fields
    if (!user_id || !title || !notificationBody) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, title, and body are required' },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }


    // Check if VAPID keys are configured
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured')
      return NextResponse.json(
        { error: 'Push notifications not configured. Missing VAPID keys.' },
        { 
          status: 500,
          headers: corsHeaders
        }
      )
    }

    // Get all push subscriptions for the user
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .eq('user_id', user_id)

    if (subscriptionError) {
      console.error('Error fetching subscriptions:', subscriptionError)
      return NextResponse.json(
        { error: 'Failed to fetch push subscriptions' },
        { 
          status: 500,
          headers: corsHeaders
        }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${user_id}`)
      return NextResponse.json(
        { 
          success: false,
          message: 'No push subscriptions found for this user',
          sent: 0
        },
        { 
          status: 200,
          headers: corsHeaders
        }
      )
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      title,
      body: notificationBody,
      icon: icon || '/assets/images/logo.png',
      badge: badge || '/assets/images/logo.png',
      image,
      tag: tag || 'connectafrik-notification',
      data: data || {},
      actions: actions || [
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
      ],
      requireInteraction: requireInteraction || false,
      silent: silent || false,
      vibrate: vibrate || [200, 100, 200],
      timestamp: Date.now()
    })

    // Send push notification to all subscriptions
    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        // web-push expects keys as base64 strings, not Buffers
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key
          }
        }

        await webpush.sendNotification(pushSubscription, payload)
        console.log(`✅ Push notification sent to ${subscription.endpoint.substring(0, 50)}...`)
        return { success: true, endpoint: subscription.endpoint }
      } catch (error: any) {
        console.error('Error sending push notification:', error)
        
        // If subscription is invalid (410 Gone), remove it from database
        if (error.statusCode === 410) {
          console.log(`Removing invalid subscription: ${subscription.endpoint}`)
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint)
        }
        
        return { 
          success: false, 
          endpoint: subscription.endpoint, 
          error: error.message 
        }
      }
    })

    const results = await Promise.all(sendPromises)
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`📊 Push notification results: ${successful} sent, ${failed} failed`)

    return NextResponse.json(
      {
        success: successful > 0,
        sent: successful,
        failed,
        total: subscriptions.length,
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
      { error: errorMessage },
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}

