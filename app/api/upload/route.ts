import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { buildStoragePath, uploadToBunny } from '@/lib/bunny'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder') || 'uploads'
    const filename = searchParams.get('filename') || 'file'
    const contentType =
      request.headers.get('content-type') || 'application/octet-stream'

    if (!request.body) {
      return errorResponse('No file provided in request body', 400)
    }

    const path = buildStoragePath(folder, filename, user.id)

    const { url } = await uploadToBunny({
      body: request.body,
      path,
      contentType,
    })

    return jsonResponse({ publicUrl: url, path })
  } catch (error: any) {
    if (
      error?.message === 'Unauthorized' ||
      error?.message === 'Missing Authorization header'
    ) {
      return unauthorizedResponse()
    }
    console.error('Bunny upload error:', error)
    return errorResponse(error?.message || 'File upload failed', 500)
  }
}
