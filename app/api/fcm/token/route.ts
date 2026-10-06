import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper to get authenticated user from request
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return null
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    console.error('Error getting authenticated user:', error)
    return null
  }
}

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders })
}

// GET /api/fcm/token - Get FCM token status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const providedUserId = searchParams.get('user_id')
    const device_id = searchParams.get('device_id')

    // Get user_id from authenticated user or from query params
    let user_id = providedUserId || null
    if (!user_id) {
      const user = await getAuthenticatedUser(request)
      if (!user) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Unauthorized. Please provide user_id query parameter or valid authorization token' 
          },
          { 
            status: 401,
            headers: corsHeaders
          }
        )
      }
      user_id = user.id
    }

    let tokenQuery = supabase
      .from('fcm_tokens')
      .select('id, fcm_token, voip_token, device_type, device_id, is_active, updated_at, created_at')
      .eq('user_id', user_id)

    if (device_id) {
      tokenQuery = tokenQuery.eq('device_id', device_id)
    }
    const { data: tokens, error } = await tokenQuery.order('updated_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching FCM tokens:', error)
      return NextResponse.json(
        { 
          success: false,
          error: 'Error fetching FCM tokens',
          tokens: []
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    return NextResponse.json(
      {
        success: true,
        tokens: tokens || [],
        count: tokens?.length || 0,
        active_count: tokens?.filter(t => t.is_active).length || 0
      },
      {
        headers: corsHeaders,
      }
    )
  } catch (error) {
    console.error('❌ Error in FCM token status API:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        tokens: []
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}

// DELETE /api/fcm/token - Remove/deactivate FCM token
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const device_id = searchParams.get('device_id')
    const fcm_token = searchParams.get('fcm_token')

    // This endpoint is intentionally unauthenticated; user_id must be provided.
    if (!user_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'user_id is required' 
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    if (!device_id && !fcm_token) {
      return NextResponse.json(
        {
          success: false,
          error: 'device_id or fcm_token is required',
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    const deactivatedAt = new Date().toISOString()
    const deactivatePayload = {
      is_active: false,
      auth_session_id: null as string | null,
      updated_at: deactivatedAt,
    }

    // Match by device_id and/or fcm_token so logout still works when localStorage
    // device_id drifted from the row stored at registration time.
    const errors: string[] = []

    if (device_id) {
      const { error } = await supabase
        .from('fcm_tokens')
        .update(deactivatePayload)
        .eq('user_id', user_id)
        .eq('device_id', device_id)
      if (error) {
        console.error('❌ Error deactivating FCM token by device_id:', error)
        errors.push(error.message)
      }
    }

    if (fcm_token) {
      const { error } = await supabase
        .from('fcm_tokens')
        .update(deactivatePayload)
        .eq('user_id', user_id)
        .eq('fcm_token', fcm_token)
      if (error) {
        console.error('❌ Error deactivating FCM token by fcm_token:', error)
        errors.push(error.message)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Error deactivating FCM token'
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'FCM token deactivated successfully'
      },
      {
        headers: corsHeaders,
      }
    )
  } catch (error) {
    console.error('❌ Error in FCM token removal API:', error)
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
