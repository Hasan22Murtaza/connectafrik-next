import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse } from '@/lib/api-utils'
import { createFeedback, isFeedbackType } from '@/lib/feedback/feedbackService'
import { buildStoragePath, uploadToBunny } from '@/lib/bunny'
import type { FeedbackType } from '@/lib/feedback/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

async function tryGetUser(request: NextRequest) {
  try {
    return await getAuthenticatedUser(request)
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await tryGetUser(request)
    const serviceClient = createServiceClient()

    const contentType = request.headers.get('content-type') || ''
    let feedbackType: string | null = null
    let title = ''
    let message = ''
    let email: string | null = null
    let userName: string | null = null
    let attachmentUrl: string | null = null
    let attachmentPath: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      feedbackType = String(form.get('feedback_type') || '')
      title = String(form.get('title') || '')
      message = String(form.get('message') || '')
      email = String(form.get('email') || '').trim() || null
      userName = String(form.get('user_name') || '').trim() || null

      const file = form.get('attachment')
      if (file && file instanceof File && file.size > 0) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          return errorResponse('Attachment must be 5MB or smaller', 400)
        }
        if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
          return errorResponse('Attachment must be a JPG, PNG, WEBP, or GIF image', 400)
        }

        const ownerId = auth?.user.id || 'guest'
        const path = buildStoragePath('feedback', file.name || 'screenshot.png', ownerId)
        const buffer = Buffer.from(await file.arrayBuffer())
        const uploaded = await uploadToBunny({
          body: buffer,
          path,
          contentType: file.type || 'application/octet-stream',
        })
        attachmentUrl = uploaded.url
        attachmentPath = uploaded.path
      }
    } else {
      const body = await request.json()
      feedbackType = body.feedback_type
      title = body.title || ''
      message = body.message || ''
      email = body.email?.trim() || null
      userName = body.user_name?.trim() || null
      attachmentUrl = body.attachment_url || null
      attachmentPath = body.attachment_path || null
    }

    if (!isFeedbackType(feedbackType)) {
      return errorResponse('Please select a valid feedback type', 400)
    }

    // Prefer authenticated profile identity when available
    if (auth?.user) {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('full_name, username')
        .eq('id', auth.user.id)
        .maybeSingle()

      if (!userName) {
        userName = profile?.full_name || profile?.username || auth.user.email || null
      }
      if (!email) {
        email = auth.user.email || null
      }
    }

    await createFeedback(serviceClient, {
      feedback_type: feedbackType as FeedbackType,
      title,
      message,
      email,
      user_name: userName,
      user_id: auth?.user.id || null,
      attachment_url: attachmentUrl,
      attachment_path: attachmentPath,
    })

    // Return only a success acknowledgement — never echo the stored row to clients
    return jsonResponse(
      { submitted: true },
      201,
      'Thank you for your feedback! We appreciate your input and will use it to improve our platform.'
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit feedback'
    const status =
      message.includes('must be') ||
      message.includes('Invalid') ||
      message.includes('valid email')
        ? 400
        : 500
    return errorResponse(message, status)
  }
}
