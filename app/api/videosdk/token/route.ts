import { NextRequest, NextResponse } from 'next/server';
import { issueCallToken } from '@/lib/call-media/provider';
import { parseProviderName } from '@/lib/call-media/resolve';
import { userInvolvedInSession } from '@/lib/call-media/session-busy';
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess';
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server';
import { isBlocked } from '@/lib/privacy/access';
import { PRIVACY_ERRORS } from '@/shared/utils/visibilityUtils';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Prefer live sessions when several rows share a room_id / call_id. */
const LIVE_CALL_STATUSES = ['initiated', 'ringing', 'active'] as const;

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders });
}

type CallSessionRow = {
  thread_id: string;
  created_by: string;
  participants: unknown;
  metadata: unknown;
  status?: string | null;
};

/**
 * Resolve call sessions by media room id or call id (newest first).
 *
 * Do NOT use maybeSingle()/single() here — room_id / call_id are not unique
 * (retries, re-rings, historical rows). maybeSingle throws PGRST116
 * ("JSON object requested, multiple (or no) rows returned") for video and
 * group joins alike.
 */
async function findCallSessionsForRoom(
  service: ReturnType<typeof createServiceClient>,
  roomId: string,
): Promise<CallSessionRow[]> {
  const select = 'thread_id, created_by, participants, metadata, status'
  const seen = new Set<string>()
  const out: CallSessionRow[] = []

  const lookup = async (column: 'room_id' | 'call_id', liveOnly: boolean) => {
    let query = service.from('call_sessions').select(select).eq(column, roomId)
    if (liveOnly) {
      query = query.in('status', [...LIVE_CALL_STATUSES])
    }
    const { data, error } = await query.order('updated_at', { ascending: false }).limit(10)
    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as CallSessionRow[]) {
      const dedupeKey = `${row.thread_id}|${row.status}|${row.created_by}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      out.push(row)
    }
  }

  // Clients pass the media room id; call_id and room_id are often different UUIDs.
  await lookup('room_id', true)
  await lookup('call_id', true)
  if (out.length === 0) {
    await lookup('room_id', false)
    await lookup('call_id', false)
  }
  return out
}

/**
 * Signed in, AND allowed on this call. Identity is derived from the session —
 * never from caller-supplied userId / displayName / avatarUrl.
 *
 * Creator / participants / metadata target/invitees always pass. Otherwise any
 * current thread member may mint a token — needed for 1:1 video accept and
 * group join before PATCH accept/join adds them to participants.
 *
 * Mid-call invites create extra ringing rows on other threads that share the
 * same room_id. Heartbeats may make the original 1:1 row "newest"; check every
 * live sibling so an invitee is not Forbidden just because lookup picked the
 * wrong row.
 */
async function authorizeForRoom(
  request: NextRequest,
  roomId: string,
): Promise<{ userId: string; displayName?: string; avatarUrl?: string }> {
  const { user } = await getAuthenticatedUser(request)

  const service = createServiceClient()
  const rows = await findCallSessionsForRoom(service, roomId)

  if (rows.length === 0) throw new Error('CallNotFound')

  let row: CallSessionRow | null = null
  for (const candidate of rows) {
    let allowed = userInvolvedInSession(candidate, user.id)
    if (!allowed && candidate.thread_id) {
      allowed = await requireChatThreadAccess(service, user.id, candidate.thread_id)
    }
    if (allowed) {
      row = candidate
      break
    }
  }
  if (!row) throw new Error('Forbidden')

  const participantIds = Array.isArray(row.participants)
    ? row.participants.filter((id: unknown): id is string => typeof id === 'string')
    : []
  const others = [...new Set([row.created_by, ...participantIds].filter(Boolean))].filter(
    (id) => id !== user.id
  )
  for (const otherId of others) {
    if (await isBlocked(user.id, otherId, service)) {
      throw new Error(PRIVACY_ERRORS.blocked)
    }
  }

  const { data: profile } = await service
    .from('profiles')
    .select('full_name, username, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const displayName =
    (typeof profile?.full_name === 'string' && profile.full_name.trim()) ||
    (typeof profile?.username === 'string' && profile.username.trim()) ||
    (typeof user.user_metadata?.full_name === 'string' &&
      user.user_metadata.full_name.trim()) ||
    undefined

  const avatarUrl =
    (typeof profile?.avatar_url === 'string' && profile.avatar_url.trim()) ||
    (typeof user.user_metadata?.avatar_url === 'string' &&
      user.user_metadata.avatar_url.trim()) ||
    undefined

  return {
    userId: user.id.trim().toLowerCase(),
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  }
}

function authErrorResponse(err: unknown): NextResponse | null {
  const msg = err instanceof Error ? err.message : '';
  if (msg === 'Unauthorized' || msg === 'Missing Authorization header') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }
  if (msg === 'CallNotFound') {
    return NextResponse.json({ error: 'Call not found' }, { status: 404, headers: corsHeaders });
  }
  if (msg === 'Forbidden' || msg === PRIVACY_ERRORS.blocked || msg === PRIVACY_ERRORS.call) {
    return NextResponse.json({ error: msg === 'Forbidden' ? 'Forbidden' : msg }, { status: 403, headers: corsHeaders });
  }
  return null;
}

async function handleTokenRequest(
  request: NextRequest,
  roomId: string,
  provider?: string | null,
) {
  const { userId, displayName, avatarUrl } = await authorizeForRoom(request, roomId);

  const credentials = await issueCallToken({
    roomId,
    userId,
    ...(parseProviderName(provider) ? { provider: parseProviderName(provider)! } : {}),
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  });

  return NextResponse.json(
    {
      token: credentials.token,
      roomId: credentials.roomId,
      userId: credentials.userId ?? userId,
      provider: credentials.provider,
      ...(credentials.wsUrl ? { wsUrl: credentials.wsUrl } : {}),
      expiresIn: credentials.expiresIn ?? '6h',
    },
    { headers: corsHeaders },
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId')?.trim() || '';

    if (!roomId) {
      return NextResponse.json(
        { error: 'Missing roomId. Provide it as a query parameter: ?roomId=xxx' },
        { status: 400, headers: corsHeaders },
      );
    }

    return await handleTokenRequest(request, roomId, searchParams.get('provider'));
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
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
    const body = await request.json().catch(() => ({}));
    const roomId =
      typeof body?.roomId === 'string' ? body.roomId.trim() : '';
    const provider = typeof body?.provider === 'string' ? body.provider : null;

    if (!roomId) {
      return NextResponse.json(
        { error: 'Missing roomId' },
        { status: 400, headers: corsHeaders },
      );
    }

    return await handleTokenRequest(request, roomId, provider);
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    console.error('[videosdk/token] POST failed:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: corsHeaders },
    );
  }
}
