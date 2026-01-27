import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as admin from 'firebase-admin'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Initialize Firebase Admin SDK
let firebaseAdmin: admin.app.App | null = null

try {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length === 0) {
    // Get Firebase service account credentials from environment
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    
    if (serviceAccount) {
      // Parse JSON string if provided as environment variable
      const credentials = typeof serviceAccount === 'string' 
        ? JSON.parse(serviceAccount) 
        : serviceAccount
      
      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(credentials),
      })
      console.log('✅ Firebase Admin SDK initialized successfully')
    } else {
      // Alternative: Use individual environment variables
      const projectId = process.env.FIREBASE_PROJECT_ID
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
      
      if (projectId && privateKey && clientEmail) {
        firebaseAdmin = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey,
            clientEmail,
          }),
        })
        console.log('✅ Firebase Admin SDK initialized with individual credentials')
      } else {
        console.warn('⚠️ Firebase credentials not found. FCM notifications will not work.')
      }
    }
  } else {
    firebaseAdmin = admin.app()
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error)
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

    if (!user_id || !title || !notificationBody) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, title, and body are required' },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    if (!firebaseAdmin) {
      console.error('Firebase Admin SDK not initialized')
      return NextResponse.json(
        { error: 'Push notifications not configured. Firebase Admin SDK not initialized.' },
        { 
          status: 500,
          headers: corsHeaders
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

    // Prepare base FCM message payload (without token)
    const baseMessage: Omit<admin.messaging.Message, 'token' | 'topic' | 'condition'> = {
      notification: {
        title,
        body: notificationBody,
        imageUrl: image,
      },
      data: {
        ...(data || {}),
        icon: icon || '/assets/images/logo.png',
        badge: badge || '/assets/images/logo.png',
        tag: tag || 'connectafrik-notification',
        requireInteraction: String(requireInteraction || false),
        silent: String(silent || false),
        vibrate: JSON.stringify(vibrate || [200, 100, 200]),
        timestamp: String(Date.now()),
        actions: JSON.stringify(actions || [
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
      webpush: {
        notification: {
          title,
          body: notificationBody,
          icon: icon || '/assets/images/logo.png',
          badge: badge || '/assets/images/logo.png',
          image,
          tag: tag || 'connectafrik-notification',
          requireInteraction: requireInteraction || false,
          silent: silent || false,
          vibrate: vibrate || [200, 100, 200],
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
        },
        fcmOptions: {
          link: data?.url || '/feed',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: silent ? undefined : 'default',
            badge: 1,
          },
        },
      },
    }

    const sendPromises = subscriptions.map(async (subscription) => {
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
        
        console.log(`✅ FCM notification sent successfully to ${subscription.device_type} device: ${response}`)
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


