import type { FamilyMemberRole } from '@/shared/types/family'
import { isChildOrTeenRole } from './auth'

/** Min age to create a family / open Family settings. */
export const FAMILY_PARENT_MIN_AGE = 18

/** Under this age, invitees may only join as Child. */
export const FAMILY_TEEN_MIN_AGE = 16

/** At this age a Child may be invited/promoted as Teen; parents are emailed. */
export const FAMILY_CHILD_TO_TEEN_NOTICE_AGE = 16

/** At this age a Child is auto-promoted to Teen (no parental controls). */
export const FAMILY_AUTO_TEEN_AGE = 18

/** Min age to invite someone as Parent or Member. */
export const FAMILY_ADULT_INVITE_MIN_AGE = 20

export function ageFromBirthday(
  birthday: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!birthday) return null
  const birth = new Date(birthday)
  if (Number.isNaN(birth.getTime())) return null

  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1
  }
  return age >= 0 ? age : null
}

export function isAdultForFamily(
  birthday: string | null | undefined,
  now: Date = new Date()
): boolean {
  const age = ageFromBirthday(birthday, now)
  return age !== null && age >= FAMILY_PARENT_MIN_AGE
}

/** Adults (18+) and parents; child/teen roles are blocked. */
export function canAccessFamilySettings(params: {
  birthday?: string | null
  familyRole?: FamilyMemberRole | null
}): boolean {
  if (params.familyRole && isChildOrTeenRole(params.familyRole)) return false
  if (params.familyRole === 'parent') return true
  return isAdultForFamily(params.birthday)
}

/**
 * Invite roles allowed for a known age.
 * - under 16 → Child only
 * - 16–19 → Child or Teen (not Parent)
 * - 20+ → Member, Teen, or Parent
 * - unknown age → Child only (safest until birthday is known)
 */
export function allowedInviteRolesForAge(age: number | null): FamilyMemberRole[] {
  if (age === null || age < FAMILY_TEEN_MIN_AGE) return ['child']
  if (age < FAMILY_ADULT_INVITE_MIN_AGE) return ['child', 'teen']
  return ['member', 'teen', 'parent']
}

export function isInviteRoleAllowedForAge(
  role: FamilyMemberRole,
  age: number | null
): boolean {
  return allowedInviteRolesForAge(age).includes(role)
}

export function inviteRoleAgeError(
  role: FamilyMemberRole,
  age: number | null
): string | null {
  if (isInviteRoleAllowedForAge(role, age)) return null

  if (age === null) {
    return 'Add a birthday on the invitee profile before inviting them as Teen, Member, or Parent. Without a known age they can only be invited as Child.'
  }
  if (age < FAMILY_TEEN_MIN_AGE) {
    return `People under ${FAMILY_TEEN_MIN_AGE} can only be invited as Child.`
  }
  if (age < FAMILY_ADULT_INVITE_MIN_AGE) {
    if (role === 'parent') {
      return `People under ${FAMILY_ADULT_INVITE_MIN_AGE} cannot be invited as Parent. Choose Child or Teen.`
    }
    if (role === 'member') {
      return `People under ${FAMILY_ADULT_INVITE_MIN_AGE} cannot be invited as Member. Choose Child or Teen.`
    }
  }
  if (age >= FAMILY_ADULT_INVITE_MIN_AGE && role === 'child') {
    return `People ${FAMILY_ADULT_INVITE_MIN_AGE}+ cannot be invited as Child. Choose Member, Teen, or Parent.`
  }
  return `That role is not allowed for age ${age}.`
}
