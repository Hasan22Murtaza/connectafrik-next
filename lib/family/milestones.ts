import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications/createNotification'
import { sendFamilyChildTurned16Email } from '@/shared/services/emailService'
import {
  FAMILY_AUTO_TEEN_AGE,
  FAMILY_CHILD_TO_TEEN_NOTICE_AGE,
  ageFromBirthday,
} from './age'
import { getActiveFamilyParents } from './verification'

async function hasMilestone(
  supabase: SupabaseClient,
  familyMemberId: string,
  milestone: 'turned_16' | 'turned_18'
): Promise<boolean> {
  const { data } = await supabase
    .from('family_age_milestones')
    .select('id')
    .eq('family_member_id', familyMemberId)
    .eq('milestone', milestone)
    .maybeSingle()
  return Boolean(data)
}

async function recordMilestone(
  supabase: SupabaseClient,
  familyMemberId: string,
  milestone: 'turned_16' | 'turned_18'
): Promise<void> {
  await supabase.from('family_age_milestones').upsert(
    {
      family_member_id: familyMemberId,
      milestone,
      notified_at: new Date().toISOString(),
    },
    { onConflict: 'family_member_id,milestone' }
  )
}

/**
 * Promote Child → Teen with no parental controls (18+ or parent-approved 16+ change).
 */
export async function promoteChildToTeen(
  supabase: SupabaseClient,
  familyMemberId: string
): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({
      role: 'teen',
      parental_oversight_enabled: false,
    })
    .eq('id', familyMemberId)
    .eq('role', 'child')

  if (error) throw new Error(error.message)

  // Disable screen-time rules so leftover settings do not re-apply if oversight is later opted in.
  await supabase
    .from('screen_time_rules')
    .update({ enabled: false })
    .eq('family_member_id', familyMemberId)
}

export async function processAgeMilestoneForMember(
  supabase: SupabaseClient,
  member: {
    id: string
    family_id: string
    user_id: string
    role: string
  },
  birthday: string | null | undefined,
  now: Date = new Date()
): Promise<{ promoted18: boolean; notified16: boolean }> {
  if (member.role !== 'child') {
    return { promoted18: false, notified16: false }
  }

  const age = ageFromBirthday(birthday, now)
  if (age === null) return { promoted18: false, notified16: false }

  let promoted18 = false
  let notified16 = false

  if (age >= FAMILY_AUTO_TEEN_AGE) {
    if (!(await hasMilestone(supabase, member.id, 'turned_18'))) {
      await promoteChildToTeen(supabase, member.id)
      await recordMilestone(supabase, member.id, 'turned_18')
      // Also mark 16 as handled so we don't email after the fact.
      if (!(await hasMilestone(supabase, member.id, 'turned_16'))) {
        await recordMilestone(supabase, member.id, 'turned_16')
      }
      promoted18 = true
    }
    return { promoted18, notified16 }
  }

  if (age >= FAMILY_CHILD_TO_TEEN_NOTICE_AGE) {
    if (!(await hasMilestone(supabase, member.id, 'turned_16'))) {
      const { data: childProfile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', member.user_id)
        .maybeSingle()

      const childName = childProfile?.full_name || childProfile?.username || 'Your child'
      const parents = await getActiveFamilyParents(supabase, member.family_id)

      for (const parent of parents) {
        if (parent.email) {
          try {
            await sendFamilyChildTurned16Email(parent.email, {
              parentName: parent.name,
              childName,
            })
          } catch (err) {
            console.error('Failed to send turned-16 email:', err)
          }
        }

        try {
          await createNotification({
            user_id: parent.user_id,
            type: 'family_child_turned_16',
            title: `${childName} is now 16+`,
            message: `${childName} is 16 or older. You can change their family status from Child to Teen if you want.`,
            data: {
              type: 'family_child_turned_16',
              family_member_id: member.id,
              url: '/family-circle',
            },
          })
        } catch (err) {
          console.error('Failed to notify parent of turned-16:', err)
        }
      }

      await recordMilestone(supabase, member.id, 'turned_16')
      notified16 = true
    }
  }

  return { promoted18, notified16 }
}

/** Cron/batch: scan active children and apply age milestones. */
export async function processAllChildAgeMilestones(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<{ scanned: number; promoted18: number; notified16: number }> {
  const { data: children, error } = await supabase
    .from('family_members')
    .select('id, family_id, user_id, role')
    .eq('role', 'child')
    .eq('status', 'active')

  if (error) throw new Error(error.message)

  let promoted18 = 0
  let notified16 = 0
  const rows = children || []

  for (const child of rows) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('birthday')
      .eq('id', child.user_id)
      .maybeSingle()

    const result = await processAgeMilestoneForMember(
      supabase,
      child,
      profile?.birthday,
      now
    )
    if (result.promoted18) promoted18 += 1
    if (result.notified16) notified16 += 1
  }

  return { scanned: rows.length, promoted18, notified16 }
}
