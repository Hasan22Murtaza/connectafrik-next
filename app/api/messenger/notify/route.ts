import { NextResponse } from 'next/server';
import { addNotification } from '@/lib/store';

export async function POST(request: Request) {
  const { roomId, callerId, callerName, targetUserId } = await request.json();

  addNotification(targetUserId, {
    roomId,
    callerId,
    callerName,
    timestamp: Date.now(),
  });

  return NextResponse.json({ success: true });
}



