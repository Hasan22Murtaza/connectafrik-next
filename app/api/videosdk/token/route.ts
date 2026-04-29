import { NextRequest, NextResponse } from 'next/server'
import { generateVideosdkParticipantJwt } from '@/lib/videosdk-participant-jwt'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    console.log('?? generate-videosdk-token GET called')
    
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const userId = searchParams.get('userId')
    
    console.log('Request params:', { roomId, userId })

    if (!roomId || !userId) {
      console.error('Missing roomId or userId:', { roomId, userId })
      return NextResponse.json(
        { error: 'Missing roomId or userId. Provide them as query parameters: ?roomId=xxx&userId=xxx' },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    const token = await generateVideosdkParticipantJwt(roomId, userId)

    console.log('? VideoSDK token generated successfully')
    return NextResponse.json(
      {
        token,
        roomId,
        userId,
        expiresIn: '10m',
      },
      {
        headers: corsHeaders,
      }
    )
  } catch (err) {
    console.error('? Error generating VideoSDK token:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    
    const body = await request.json()
    const { roomId, userId } = body

    if (!roomId || !userId) {
      console.error('Missing roomId or userId:', { roomId, userId })
      return NextResponse.json(
        { error: 'Missing roomId or userId' },
        { 
          status: 400,
          headers: corsHeaders
        }
      )
    }

    const token = await generateVideosdkParticipantJwt(roomId, userId)

    console.log('? VideoSDK token generated successfully')
    return NextResponse.json(
      {
        token,
        roomId,
        userId,
        expiresIn: '10m',
      },
      {
        headers: corsHeaders,
      }
    )
  } catch (err) {
    console.error('? Error generating VideoSDK token:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
}
