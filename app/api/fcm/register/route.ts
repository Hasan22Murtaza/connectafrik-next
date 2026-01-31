import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fcm_token, device_type, device_id, user_id: providedUserId } = body

    // Validate required fields
    if (!fcm_token || !device_type || !device_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields: fcm_token, device_type, and device_id are required' 
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    // Validate device_type
    if (!['web', 'ios', 'android'].includes(device_type)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid device_type. Must be one of: web, ios, android' 
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    // Get user_id from authenticated user or from request body
    let user_id = providedUserId
    if (!user_id) {
      const user = await getAuthenticatedUser(request)
      if (!user) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Unauthorized. Please provide user_id or valid authorization token' 
          },
          { 
            status: 401,
            headers: corsHeaders
          }
        )
      }
      user_id = user.id
    }

    // Check if token record already exists for this user + device combination
    const { data: existingDeviceToken, error: checkError } = await supabase
      .from('fcm_tokens')
      .select('id, fcm_token, is_active, user_id, device_id')
      .eq('user_id', user_id)
      .eq('device_id', device_id)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking for existing device token:', checkError)
      return NextResponse.json(
        { 
          success: false,
          error: 'Error checking for existing token',
          data: { error: checkError.message }
        },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    let resultData: any = null

    if (existingDeviceToken) {
      // Token record exists for this user + device, update it with the new token
      const { data: updatedData, error: updateError } = await supabase
        .from('fcm_tokens')
        .update({
          fcm_token: fcm_token,
          is_active: true,
          device_type: device_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDeviceToken.id)
        .select()

      if (updateError) {
        console.error('❌ Error updating FCM token:', updateError)
        return NextResponse.json(
          { 
            success: false,
            error: 'Error updating FCM token',
            data: { error: updateError.message }
          },
          { 
            status: 400,
            headers: corsHeaders
          }
        )
      }

      resultData = updatedData?.[0]
    } else {
      // No token record exists for this user + device combination, insert new one
      const tokenRecord = {
        user_id,
        fcm_token,
        device_type: device_type as 'web' | 'ios' | 'android',
        device_id,
        is_active: true,
        updated_at: new Date().toISOString()
      }

      const { data: insertedData, error: insertError } = await supabase
        .from('fcm_tokens')
        .insert(tokenRecord)
        .select()

      if (insertError) {
        console.error('❌ Error inserting FCM token:', insertError)
        
        // If insert fails due to unique constraint, try to find and update existing record
        if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
          const { data: checkAgain, error: recheckError } = await supabase
            .from('fcm_tokens')
            .select('id, user_id, fcm_token, is_active, device_id')
            .eq('user_id', user_id)
            .eq('device_id', device_id)
            .maybeSingle()

          if (recheckError && recheckError.code !== 'PGRST116') {
            return NextResponse.json(
              { 
                success: false,
                error: 'Error rechecking token',
                data: { error: recheckError.message }
              },
              { 
                status: 400,
                headers: corsHeaders
              }
            )
          }

          if (checkAgain) {
            const { data: updateData, error: updateError2 } = await supabase
              .from('fcm_tokens')
              .update({
                fcm_token: fcm_token,
                is_active: true,
                device_type: device_type,
                updated_at: new Date().toISOString()
              })
              .eq('id', checkAgain.id)
              .select()

            if (updateError2) {
              return NextResponse.json(
                { 
                  success: false,
                  error: 'Error updating token after insert failure',
                  data: { error: updateError2.message }
                },
                { 
                  status: 400,
                  headers: corsHeaders
                }
              )
            }

            resultData = updateData?.[0]
          } else {
            return NextResponse.json(
              { 
                success: false,
                error: 'Error inserting FCM token',
                data: { error: insertError.message }
              },
              { 
                status: 400,
                headers: corsHeaders
              }
            )
          }
        } else {
          return NextResponse.json(
            { 
              success: false,
              error: 'Error inserting FCM token',
              data: { error: insertError.message }
            },
            { 
              status: 400,
              headers: corsHeaders
            }
          )
        }
      } else {
        resultData = insertedData?.[0]
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: existingDeviceToken ? 'FCM token updated successfully' : 'FCM token registered successfully',
        data: resultData
      },
      {
        headers: corsHeaders,
      }
    )
  } catch (error) {
    console.error('❌ Error in FCM register API:', error)
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
