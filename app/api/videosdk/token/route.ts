import { NextRequest, NextResponse } from 'next/server';
import { issueCallToken } from '@/lib/call-media/provider';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders });
}

async function handleTokenRequest(roomId: string, userId: string) {
  const credentials = await issueCallToken({ roomId, userId });

  return NextResponse.json(
    {
      token: credentials.token,
      roomId: credentials.roomId,
      userId: credentials.userId ?? userId,
      provider: credentials.provider,
      ...(credentials.wsUrl ? { wsUrl: credentials.wsUrl } : {}),
      expiresIn: credentials.expiresIn ?? '10m',
    },
    { headers: corsHeaders },
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const userId = searchParams.get('userId');

    if (!roomId || !userId) {
      return NextResponse.json(
        {
          error:
            'Missing roomId or userId. Provide them as query parameters: ?roomId=xxx&userId=xxx',
        },
        { status: 400, headers: corsHeaders },
      );
    }

    return await handleTokenRequest(roomId, userId);
  } catch (err) {
    console.error('[videosdk/token] GET failed:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, userId } = body;

    if (!roomId || !userId) {
      return NextResponse.json(
        { error: 'Missing roomId or userId' },
        { status: 400, headers: corsHeaders },
      );
    }

    return await handleTokenRequest(roomId, userId);
  } catch (err) {
    console.error('[videosdk/token] POST failed:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: corsHeaders },
    );
  }
}
