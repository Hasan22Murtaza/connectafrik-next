import type { FamilyMemberRole } from '@/shared/types/family'
import { isManagedRole } from './auth'

/** Min age to create a family / open Family settings. */
export const FAMILY_PARENT_MIN_AGE = 18

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
  if (params.familyRole && isManagedRole(params.familyRole)) return false
  if (params.familyRole === 'parent') return true
  return isAdultForFamily(params.birthday)
}
