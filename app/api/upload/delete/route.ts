import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { deleteFromBunny } from '@/lib/bunny'
import { isOwnedBunnyPath } from '@/lib/security/bunnyOwnership'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)

    const body = await request.json().catch(() => ({}))
    const target: string | undefined = body.url || body.path || body.key

    if (!target || typeof target !== 'string') {
      return errorResponse('Missing file url/path to delete', 400)
    }

    if (!isOwnedBunnyPath(target, user.id)) {
      return errorResponse('Forbidden: you can only delete your own files', 403)
    }

    await deleteFromBunny(target)

    return jsonResponse({ deleted: true })
  } catch (error: any) {
    if (
      error?.message === 'Unauthorized' ||
      error?.message === 'Missing Authorization header'
    ) {
      return unauthorizedResponse()
    }
    console.error('Bunny delete error:', error)
    return errorResponse(error?.message || 'Failed to delete file', 500)
  }
}
