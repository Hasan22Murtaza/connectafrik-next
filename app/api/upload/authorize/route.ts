import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { buildStoragePath, isAllowedUploadFolder } from '@/lib/bunny'
import { createPresignedPut } from '@/lib/bunny-s3'

export const runtime = 'nodejs'

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return message === 'Unauthorized' || message === 'Missing Authorization header'
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))

    const folder = String(body.folder || '').trim().toLowerCase()
    const filename = String(body.filename || 'file').trim() || 'file'
    const contentType =
      String(body.contentType || '').trim() || 'application/octet-stream'

    if (!isAllowedUploadFolder(folder)) {
      return errorResponse('Invalid upload folder', 400)
    }

    const path = buildStoragePath(folder, filename, user.id)
    const signed = await createPresignedPut({ path, contentType })

    return jsonResponse(signed)
  } catch (error: any) {
    if (authError(error)) return unauthorizedResponse()
    console.error('Upload authorize error:', error)
    return errorResponse(error?.message || 'Failed to authorize upload', 500)
  }
}
