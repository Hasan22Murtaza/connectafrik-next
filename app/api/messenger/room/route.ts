import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST() {
  const VIDEOSDK_API_KEY = process.env.VIDEOSDK_API_KEY;
  const VIDEOSDK_SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;

  if (!VIDEOSDK_API_KEY || !VIDEOSDK_SECRET_KEY) {
    return NextResponse.json(
      { error: 'API keys not configured' },
      { status: 500 }
    );
  }

  try {
    // Generate a token for room creation
    const token = jwt.sign(
      {
        apikey: VIDEOSDK_API_KEY,
        permissions: ['allow_join', 'allow_mod'],
        version: 2,
      },
      VIDEOSDK_SECRET_KEY,
      {
        algorithm: 'HS256',
        expiresIn: '24h',
      }
    );

    // Create a new room using VideoSDK API
    const response = await fetch('https://api.videosdk.live/v2/rooms', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || `HTTP ${response.status}: ${response.statusText}` };
      }
      
      console.error('VideoSDK Room API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        apiKey: VIDEOSDK_API_KEY ? `${VIDEOSDK_API_KEY.substring(0, 10)}...` : 'missing',
      });

      return NextResponse.json(
        { 
          error: errorData.message || errorData.error || 'Failed to create room',
          details: `Status: ${response.status}. Please verify your API key is correct.`,
          hint: 'Make sure your VIDEOSDK_API_KEY is correct in .env.local'
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.roomId) {
      return NextResponse.json(
        { error: 'Room ID not found in response', response: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ roomId: data.roomId });
  } catch (error: any) {
    console.error('Room creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create room',
        details: error.message || 'Network error or invalid API endpoint',
        hint: 'Check your internet connection and VideoSDK API endpoint availability'
      },
      { status: 500 }
    );
  }
}

