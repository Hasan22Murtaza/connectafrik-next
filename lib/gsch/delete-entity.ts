import type { SupabaseClient } from '@supabase/supabase-js'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'

type DeleteGschOrgEntityArgs = {
  supabase: SupabaseClient
  userId: string
  id: string
  table: string
  entityType: string
  action: string
  notFoundMessage: string
  minRole?: 'owner' | 'admin' | 'representative' | 'member'
}

export async function deleteGschOrgEntity({
  supabase,
  userId,
  id,
  table,
  entityType,
  action,
  notFoundMessage,
  minRole = 'representative',
}: DeleteGschOrgEntityArgs) {
  try {
    const { data: existing, error: loadError } = await supabase
      .from(table)
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()

    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse(notFoundMessage, 404)

    const authz = await requireOrgRole(
      supabase,
      existing.organization_id,
      userId,
      minRole
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: userId,
      action,
      entity_type: entityType,
      entity_id: id,
      metadata: { deleted: true },
    })

    return jsonResponse({ deleted: true, id })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete', 500)
  }
}
