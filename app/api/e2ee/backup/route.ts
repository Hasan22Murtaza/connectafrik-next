import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { BACKUP_KDF } from '@/lib/e2ee/media'

const MAX_BACKUP_CHARS = 2_000_000

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('e2ee_key_backups')
      .select('ciphertext, salt, iv, kdf, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to load key backup', 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()
    const ciphertext = typeof body.ciphertext === 'string' ? body.ciphertext : ''
    const salt = typeof body.salt === 'string' ? body.salt : ''
    const iv = typeof body.iv === 'string' ? body.iv : ''
    const kdf = typeof body.kdf === 'string' ? body.kdf : ''
    if (!ciphertext || !salt || !iv || ciphertext.length > MAX_BACKUP_CHARS) {
      return errorResponse('Invalid key backup', 400)
    }
    if (kdf !== BACKUP_KDF) return errorResponse('Unsupported key backup', 400)
    const serviceClient = createServiceClient()
    const { error } = await serviceClient.from('e2ee_key_backups').upsert(
      {
        user_id: user.id,
        ciphertext,
        salt,
        iv,
        kdf,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ saved: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to save key backup', 500)
  }
}
