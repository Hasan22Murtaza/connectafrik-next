import { NextRequest, NextResponse } from 'next/server'

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

    const apiKey =
      process.env.VIDEOSDK_API_KEY ??
      process.env.VITE_VIDEOSDK_API_KEY ??
      process.env.NEXT_PUBLIC_VIDEOSDK_API_KEY
    const apiSecret =
      process.env.VIDEOSDK_SECRET_KEY ??
      process.env.VIDEOSDK_SECRET ??
      process.env.VITE_VIDEOSDK_SECRET_KEY ??
      process.env.NEXT_PUBLIC_VIDEOSDK_SECRET_KEY

    if (!apiKey || !apiSecret) {
      throw new Error('Missing VideoSDK credentials')
    }

    // Generate JWT token using Web Crypto API (available in Node.js 18+)
    const token = await generateJWTToken(apiKey, apiSecret, roomId, userId)

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
    console.log('?? generate-videosdk-token called')
    
    const authHeader = request.headers.get('Authorization')
    console.log('Authorization header:', authHeader ? 'Present' : 'Missing')

    const body = await request.json()
    const { roomId, userId } = body
    console.log('Request params:', { roomId, userId })

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

    const apiKey =
      process.env.VIDEOSDK_API_KEY ??
      process.env.VITE_VIDEOSDK_API_KEY ??
      process.env.NEXT_PUBLIC_VIDEOSDK_API_KEY
    const apiSecret =
      process.env.VIDEOSDK_SECRET_KEY ??
      process.env.VIDEOSDK_SECRET ??
      process.env.VITE_VIDEOSDK_SECRET_KEY ??
      process.env.NEXT_PUBLIC_VIDEOSDK_SECRET_KEY

    if (!apiKey || !apiSecret) {
      throw new Error('Missing VideoSDK credentials')
    }

    // Generate JWT token using Web Crypto API (available in Node.js 18+)
    const token = await generateJWTToken(apiKey, apiSecret, roomId, userId)

    console.log('? VideoSDK token generated successfully', token)
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

/**
 * Generate JWT token using Web Crypto API
 */
async function generateJWTToken(
  apiKey: string,
  apiSecret: string,
  roomId: string,
  userId: string
): Promise<string> {
  // JWT Header
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  // JWT Payload
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    apikey: apiKey,
    permissions: ['allow_join', 'allow_mod'],
    version: 2,
    roomId,
    userId,
    exp: now + 600, // 10 minutes expiry
    iat: now,
  }

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))

  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureInput))
  const encodedSignature = base64UrlEncodeFromBuffer(signature)

  // Return complete JWT
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

/**
 * Base64 URL encode a string
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Base64 URL encode from ArrayBuffer
 */
function base64UrlEncodeFromBuffer(buffer: ArrayBuffer): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
