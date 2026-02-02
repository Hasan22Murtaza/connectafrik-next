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

    const { data: tokens, error } = await supabase
      .from('fcm_tokens')
      .select('id, fcm_token, device_type, device_id, is_active, updated_at, created_at')
      .eq('user_id', user_id)
      .order('updated_at', { ascending: false })

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

    let query = supabase
      .from('fcm_tokens')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)


    if (device_id) {
      query = query.eq('device_id', device_id)
    }

    const { error } = await query

    if (error) {
      console.error('❌ Error deactivating FCM token:', error)
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
