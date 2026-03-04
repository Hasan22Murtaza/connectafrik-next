import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase } = await getAuthenticatedUser(request)

    const { data: row, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error || !row) {
      return errorResponse('Friend request not found', 404)
    }

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', row.sender_id)
      .single()

    return jsonResponse({
      ...row,
      sender: senderProfile || null,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch friend request', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const body = await request.json().catch(() => ({}))
    const status = body?.status

    if (!status || !['accepted', 'declined', 'blocked'].includes(status)) {
      return errorResponse('status must be one of: accepted, declined, blocked', 400)
    }

    const { data: row, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, receiver_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !row) {
      return errorResponse('Friend request not found', 404)
    }

    if (row.receiver_id !== user.id) {
      return errorResponse('Forbidden', 403)
    }

    if (row.status !== 'pending') {
      return errorResponse('Request already responded to', 400)
    }

    const { data: updated, error: updateError } = await supabase
      .from('friend_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message, 400)
    }

    return jsonResponse(updated)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update friend request', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: row, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !row) {
      return errorResponse('Friend request not found', 404)
    }

    if (row.sender_id !== user.id) {
      return errorResponse('Forbidden', 403)
    }

    if (row.status !== 'pending') {
      return errorResponse('Request is not pending', 400)
    }

    const { error: deleteError } = await supabase.from('friend_requests').delete().eq('id', id)

    if (deleteError) {
      return errorResponse(deleteError.message, 400)
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to cancel friend request', 500)
  }
}
