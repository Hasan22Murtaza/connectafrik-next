import type { SupabaseClient } from '@supabase/supabase-js'
import type { SafetyAlertSeverity, SafetyAlertType } from '@/shared/types/family'
import { createNotification } from '@/lib/notifications/createNotification'
import { getActiveMembership, isManagedRole } from './auth'

export async function createSafetyAlertForUser(
  serviceSupabase: SupabaseClient,
  params: {
    userId: string
    alertType: SafetyAlertType
    severity?: SafetyAlertSeverity
    title: string
    description?: string
    source?: string
    relatedUserId?: string
    relatedContentId?: string
  }
): Promise<string | null> {
  const membership = await getActiveMembership(serviceSupabase, params.userId)
  if (!membership || !isManagedRole(membership.role)) {
    return null
  }

  const { data: alert, error } = await serviceSupabase
    .from('safety_alerts')
    .insert({
      family_member_id: membership.id,
      alert_type: params.alertType,
      severity: params.severity || 'medium',
      title: params.title,
      description: params.description ?? null,
      source: params.source ?? null,
      related_user_id: params.relatedUserId ?? null,
      related_content_id: params.relatedContentId ?? null,
      status: 'open',
    })
    .select('id')
    .single()

  if (error || !alert) {
    console.error('Failed to create safety alert:', error?.message)
    return null
  }

  await serviceSupabase.from('activity_events').insert({
    family_member_id: membership.id,
    user_id: params.userId,
    event_type: 'safety_alert',
    quantity: 1,
    metadata: { alert_id: alert.id, alert_type: params.alertType },
  })

  const { data: parents } = await serviceSupabase
    .from('family_members')
    .select('user_id')
    .eq('family_id', membership.family_id)
    .eq('role', 'parent')
    .eq('status', 'active')

  for (const parent of parents || []) {
    try {
      await createNotification({
        user_id: parent.user_id,
        type: 'family_safety_alert',
        title: 'New safety alert',
        message: params.title,
        data: {
          type: 'family_safety_alert',
          alert_id: alert.id,
          family_member_id: membership.id,
          url: '/settings?tab=family',
        },
      })
    } catch (err) {
      console.error('Failed to notify parent of safety alert:', err)
    }
  }

  return alert.id
}
