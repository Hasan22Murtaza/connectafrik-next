import { NextRequest } from 'next/server'

import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'

import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

import {

  CHAT_THREAD_DETAIL_SELECT,

  getMyThreadUnreadCount,

  threadToResponseBody,

} from '@/lib/chatThreadDetail'



type RouteContext = { params: Promise<{ threadId: string }> }



export async function GET(request: NextRequest, context: RouteContext) {

  try {

    const { threadId } = await context.params

    const { user } = await getAuthenticatedUser(request)

    const serviceClient = createServiceClient()



    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)

    if (!allowed) {

      return errorResponse('Thread not found or access denied', 404)

    }



    const { data: thread, error } = await serviceClient

      .from('chat_threads')

      .select(CHAT_THREAD_DETAIL_SELECT)

      .eq('id', threadId)

      .single()



    if (error || !thread) {

      return errorResponse('Thread not found', 404)

    }



    const unread_count = await getMyThreadUnreadCount(serviceClient, user.id, threadId)

    return jsonResponse(threadToResponseBody(thread as Record<string, unknown>, unread_count))

  } catch (error: any) {

    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {

      return unauthorizedResponse()

    }

    return errorResponse(error.message || 'Failed to fetch thread', 500)

  }

}



export async function PATCH(request: NextRequest, context: RouteContext) {

  try {

    const { threadId } = await context.params

    const { user } = await getAuthenticatedUser(request)

    const serviceClient = createServiceClient()



    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)

    if (!allowed) {

      return errorResponse('Thread not found or access denied', 404)

    }



    const body = await request.json()

    const allowedFields = ['title', 'name', 'banner_url'] as const

    const updates: Record<string, unknown> = {}



    for (const key of allowedFields) {

      if (body[key] === undefined) continue

      if (key === 'banner_url') {

        if (body[key] === null || body[key] === '') {

          updates[key] = null

        } else if (typeof body[key] === 'string') {

          updates[key] = body[key]

        } else {

          return errorResponse('banner_url must be a string or null', 400)

        }

      } else if (typeof body[key] === 'string' || body[key] === null) {

        updates[key] = body[key]

      } else {

        return errorResponse(`${key} must be a string or null`, 400)

      }

    }



    if (Object.keys(updates).length === 0) {

      return errorResponse('No valid fields to update', 400)

    }



    const { data: thread, error } = await serviceClient

      .from('chat_threads')

      .update(updates)

      .eq('id', threadId)

      .select(CHAT_THREAD_DETAIL_SELECT)

      .single()



    if (error || !thread) {

      return errorResponse(error?.message || 'Failed to update thread', 400)

    }



    const unread_count = await getMyThreadUnreadCount(serviceClient, user.id, threadId)

    return jsonResponse(threadToResponseBody(thread as Record<string, unknown>, unread_count))

  } catch (error: any) {

    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {

      return unauthorizedResponse()

    }

    return errorResponse(error.message || 'Failed to update thread', 500)

  }

}

