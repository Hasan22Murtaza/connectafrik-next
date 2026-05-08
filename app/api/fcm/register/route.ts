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
    const {
      fcm_token,
      device_type,
      device_id,
      user_id: providedUserId,
      token_kind: incomingTokenKind,
      voip_token: incomingVoipToken
    } = body
    const token_kind = incomingTokenKind === 'voip' ? 'voip' : 'standard'
    const voip_token =
      typeof incomingVoipToken === 'string' && incomingVoipToken.trim()
        ? incomingVoipToken.trim()
        : null

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

    // Validate token_kind
    if (!['standard', 'voip'].includes(token_kind)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token_kind. Must be one of: standard, voip'
        },
        {
          status: 400,
          headers: corsHeaders
        }
      )
    }

    if (device_type !== 'ios' && voip_token) {
      return NextResponse.json(
        {
          success: false,
          error: 'voip_token is only supported for ios device_type'
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

    // Check if token record already exists for this device (global device uniqueness).
    // A physical device should map to a single fcm_tokens row at any time.
    const { data: existingDeviceToken, error: checkError } = await supabase
      .from('fcm_tokens')
      .select('id, fcm_token, voip_token, is_active, user_id, device_id, token_kind')
      .eq('device_id', device_id)
      .eq('token_kind', token_kind)
      .order('updated_at', { ascending: false })
      .limit(1)
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
      // Token record exists for this device, update it (including owner user_id)
      // so we never create duplicate rows for the same device_id.
      const { data: updatedData, error: updateError } = await supabase
        .from('fcm_tokens')
        .update({
          user_id,
          fcm_token: fcm_token,
          voip_token: device_type === 'ios' ? voip_token : null,
          is_active: true,
          device_type: device_type,
          token_kind,
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
      if (resultData?.id) {
        // Safety cleanup for legacy duplicates: keep newest row active and deactivate others.
        await supabase
          .from('fcm_tokens')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('device_id', device_id)
          .eq('token_kind', token_kind)
          .neq('id', resultData.id)
      }
    } else {
      // No token record exists for this device_id, insert new one
      const tokenRecord = {
        user_id,
        fcm_token,
        voip_token: device_type === 'ios' ? voip_token : null,
        device_type: device_type as 'web' | 'ios' | 'android',
        token_kind: token_kind as 'standard' | 'voip',
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
        
        // If insert fails due to unique constraint, try to find and update by device_id
        if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
          const { data: checkAgain, error: recheckError } = await supabase
            .from('fcm_tokens')
            .select('id, user_id, fcm_token, voip_token, is_active, device_id, token_kind')
            .eq('device_id', device_id)
            .eq('token_kind', token_kind)
            .order('updated_at', { ascending: false })
            .limit(1)
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
                user_id,
                fcm_token: fcm_token,
                voip_token: device_type === 'ios' ? voip_token : null,
                is_active: true,
                device_type: device_type,
                token_kind,
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
            if (resultData?.id) {
              // Safety cleanup for legacy duplicates: keep newest row active and deactivate others.
              await supabase
                .from('fcm_tokens')
                .update({
                  is_active: false,
                  updated_at: new Date().toISOString()
                })
                .eq('device_id', device_id)
                .eq('token_kind', token_kind)
                .neq('id', resultData.id)
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

    // Backward compatibility: if an iOS VoIP token is provided, also maintain token_kind='voip'
    // row so existing VoIP push flow keeps working while clients move to voip_token field.
    if (device_type === 'ios' && voip_token) {
      const { data: existingVoipRow, error: voipCheckError } = await supabase
        .from('fcm_tokens')
        .select('id')
        .eq('device_id', device_id)
        .eq('token_kind', 'voip')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (voipCheckError && voipCheckError.code !== 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'Error checking VoIP token row',
            data: { error: voipCheckError.message }
          },
          {
            status: 400,
            headers: corsHeaders
          }
        )
      }

      if (existingVoipRow?.id) {
        const { error: voipUpdateError } = await supabase
          .from('fcm_tokens')
          .update({
            user_id,
            fcm_token: voip_token,
            voip_token,
            is_active: true,
            device_type: 'ios',
            token_kind: 'voip',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingVoipRow.id)

        if (voipUpdateError) {
          return NextResponse.json(
            {
              success: false,
              error: 'Error updating VoIP token row',
              data: { error: voipUpdateError.message }
            },
            {
              status: 400,
              headers: corsHeaders
            }
          )
        }
      } else {
        const { error: voipInsertError } = await supabase
          .from('fcm_tokens')
          .insert({
            user_id,
            fcm_token: voip_token,
            voip_token,
            device_type: 'ios',
            token_kind: 'voip',
            device_id,
            is_active: true,
            updated_at: new Date().toISOString()
          })

        if (voipInsertError) {
          return NextResponse.json(
            {
              success: false,
              error: 'Error inserting VoIP token row',
              data: { error: voipInsertError.message }
            },
            {
              status: 400,
              headers: corsHeaders
            }
          )
        }
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
