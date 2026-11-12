import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables (SUPABASE_SERVICE_ROLE_KEY required for FCM)')
}

const supabase = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return null
  }

  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const {
      data: { user },
      error,
    } = await authClient.auth.getUser()

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
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Server misconfigured' },
        { status: 500, headers: corsHeaders }
      )
    }

    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Valid authorization token is required',
        },
        {
          status: 401,
          headers: corsHeaders,
        }
      )
    }

    const body = await request.json()
    const {
      fcm_token,
      device_type,
      device_id,
      user_id: providedUserId,
      voip_token: incomingVoipToken,
      auth_session_id: incomingAuthSessionId,
    } = body
    const voip_token =
      typeof incomingVoipToken === 'string' && incomingVoipToken.trim()
        ? incomingVoipToken.trim()
        : null

    // Identity comes only from the verified session — never trust body user_id.
    const user_id = user.id
    if (
      typeof providedUserId === 'string' &&
      providedUserId.trim() &&
      providedUserId.trim() !== user_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'user_id does not match authenticated user',
        },
        {
          status: 403,
          headers: corsHeaders,
        }
      )
    }

    if (!fcm_token || !device_type || !device_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: fcm_token, device_type, and device_id are required',
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    if (!['web', 'ios', 'android'].includes(device_type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid device_type. Must be one of: web, ios, android',
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    if (device_type !== 'ios' && voip_token) {
      return NextResponse.json(
        {
          success: false,
          error: 'voip_token is only supported for ios device_type',
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    let auth_session_id: string | null =
      typeof incomingAuthSessionId === 'string' && incomingAuthSessionId.trim()
        ? incomingAuthSessionId.trim()
        : null
    if (!auth_session_id) {
      const authHeader = request.headers.get('authorization')
      const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
      if (bearer) {
        try {
          const decoded = jwt.decode(bearer) as { session_id?: string } | null
          if (typeof decoded?.session_id === 'string' && decoded.session_id.trim()) {
            auth_session_id = decoded.session_id.trim()
          }
        } catch {
          // ignore decode errors
        }
      }
    }

    const { data: existingByUserDevice, error: checkError } = await supabase
      .from('fcm_tokens')
      .select('id, fcm_token, voip_token, is_active, user_id, device_id')
      .eq('user_id', user_id)
      .eq('device_id', device_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking for existing device token:', checkError)
      return NextResponse.json(
        {
          success: false,
          error: 'Error checking for existing token',
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      )
    }

    let existingByUserToken: {
      id: string
      fcm_token: string
      voip_token: string | null
      is_active: boolean
      user_id: string
      device_id: string
    } | null = null
    if (!existingByUserDevice) {
      const { data: byToken, error: byTokenError } = await supabase
        .from('fcm_tokens')
        .select('id, fcm_token, voip_token, is_active, user_id, device_id')
        .eq('user_id', user_id)
        .eq('fcm_token', fcm_token)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (byTokenError && byTokenError.code !== 'PGRST116') {
        console.error('❌ Error checking for existing user FCM token:', byTokenError)
        return NextResponse.json(
          {
            success: false,
            error: 'Error checking for existing token',
          },
          {
            status: 400,
            headers: corsHeaders,
          }
        )
      }
      existingByUserToken = byToken
    }

    const existingTokenRow = existingByUserDevice ?? existingByUserToken

    let resultData: any = null

    if (existingTokenRow) {
      const { data: updatedData, error: updateError } = await supabase
        .from('fcm_tokens')
        .update({
          user_id,
          fcm_token: fcm_token,
          device_id,
          voip_token: device_type === 'ios' ? voip_token : null,
          auth_session_id,
          is_active: true,
          device_type: device_type,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTokenRow.id)
        .select()

      if (updateError) {
        console.error('❌ Error updating FCM token:', updateError)
        return NextResponse.json(
          {
            success: false,
            error: 'Error updating FCM token',
          },
          {
            status: 400,
            headers: corsHeaders,
          }
        )
      }

      resultData = updatedData?.[0]
      if (resultData?.id) {
        await supabase
          .from('fcm_tokens')
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user_id)
          .eq('device_id', device_id)
          .neq('id', resultData.id)
      }
    } else {
      const tokenRecord = {
        user_id,
        fcm_token,
        voip_token: device_type === 'ios' ? voip_token : null,
        device_type: device_type as 'web' | 'ios' | 'android',
        device_id,
        auth_session_id,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      const { data: insertedData, error: insertError } = await supabase
        .from('fcm_tokens')
        .insert(tokenRecord)
        .select()

      if (insertError) {
        console.error('❌ Error inserting FCM token:', insertError)

        if (
          insertError.code === '23505' ||
          insertError.message?.includes('duplicate') ||
          insertError.message?.includes('unique')
        ) {
          const { data: byUserDevice, error: errUserDevice } = await supabase
            .from('fcm_tokens')
            .select('id, user_id, fcm_token, voip_token, is_active, device_id')
            .eq('user_id', user_id)
            .eq('device_id', device_id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const { data: byUserToken, error: errUserToken } = await supabase
            .from('fcm_tokens')
            .select('id, user_id, fcm_token, voip_token, is_active, device_id')
            .eq('user_id', user_id)
            .eq('fcm_token', fcm_token)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const recheckError =
            errUserDevice && errUserDevice.code !== 'PGRST116'
              ? errUserDevice
              : errUserToken && errUserToken.code !== 'PGRST116'
                ? errUserToken
                : null
          if (recheckError) {
            return NextResponse.json(
              {
                success: false,
                error: 'Error rechecking token',
              },
              {
                status: 400,
                headers: corsHeaders,
              }
            )
          }

          const checkAgain = byUserDevice ?? byUserToken

          if (checkAgain) {
            const { data: updateData, error: updateError2 } = await supabase
              .from('fcm_tokens')
              .update({
                user_id,
                fcm_token: fcm_token,
                device_id,
                voip_token: device_type === 'ios' ? voip_token : null,
                auth_session_id,
                is_active: true,
                device_type: device_type,
                updated_at: new Date().toISOString(),
              })
              .eq('id', checkAgain.id)
              .select()

            if (updateError2) {
              return NextResponse.json(
                {
                  success: false,
                  error: 'Error updating token after insert failure',
                },
                {
                  status: 400,
                  headers: corsHeaders,
                }
              )
            }

            resultData = updateData?.[0]
            if (resultData?.id) {
              await supabase
                .from('fcm_tokens')
                .update({
                  is_active: false,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', user_id)
                .eq('device_id', device_id)
                .neq('id', resultData.id)
            }
          } else {
            return NextResponse.json(
              {
                success: false,
                error: 'Error inserting FCM token',
              },
              {
                status: 400,
                headers: corsHeaders,
              }
            )
          }
        } else {
          return NextResponse.json(
            {
              success: false,
              error: 'Error inserting FCM token',
            },
            {
              status: 400,
              headers: corsHeaders,
            }
          )
        }
      } else {
        resultData = insertedData?.[0]
        if (resultData?.id) {
          await supabase
            .from('fcm_tokens')
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user_id)
            .eq('device_id', device_id)
            .neq('id', resultData.id)
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: existingTokenRow
          ? 'FCM token updated successfully'
          : 'FCM token registered successfully',
        data: resultData,
      },
      {
        headers: corsHeaders,
      }
    )
  } catch (error) {
    console.error('❌ Error in FCM register API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}
