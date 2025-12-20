import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET() {
  const VIDEOSDK_API_KEY = process.env.VIDEOSDK_API_KEY;
  const VIDEOSDK_SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;

  if (!VIDEOSDK_API_KEY || !VIDEOSDK_SECRET_KEY) {
    return NextResponse.json(
      { error: 'API keys not configured. Please check your .env.local file.' },
      { status: 500 }
    );
  }

  try {
    // Generate JWT token for VideoSDK
    // VideoSDK requires JWT tokens signed with the secret key
    const payload = {
      apikey: VIDEOSDK_API_KEY,
      permissions: ['allow_join', 'allow_mod'],
      version: 2,
      roles: ['CRAWLER', 'RTMP'],
    };

    // Generate token with 24 hour expiration
    const token = jwt.sign(payload, VIDEOSDK_SECRET_KEY, {
      algorithm: 'HS256',
      expiresIn: '24h',
      jwtid: Math.random().toString(36).substring(7),
    });

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate token',
        details: error.message || 'Error generating JWT token',
        hint: 'Please verify your VIDEOSDK_SECRET_KEY is correct in .env.local'
      },
      { status: 500 }
    );
  }
}
