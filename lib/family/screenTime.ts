import type { ScreenTimeRules } from '@/shared/types/family'

export type ScreenTimeEvaluation = {
  allowed: boolean
  reason?: 'daily_limit' | 'outside_allowed_hours' | 'bedtime' | 'disabled'
  message?: string
  usedMinutes: number
  dailyLimitMinutes: number | null
}

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') return null
  const parts = value.split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/** Inclusive start / exclusive end; supports overnight ranges. */
export function isWithinTimeWindow(
  nowMinutes: number,
  startMinutes: number | null,
  endMinutes: number | null
): boolean | null {
  if (startMinutes === null || endMinutes === null) return null
  if (startMinutes === endMinutes) return true
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes
}

export function evaluateScreenTime(
  rules: Pick<
    ScreenTimeRules,
    | 'enabled'
    | 'daily_limit_minutes'
    | 'allowed_start_time'
    | 'allowed_end_time'
    | 'bedtime_start'
    | 'bedtime_end'
  > | null,
  usedMinutes: number,
  now: Date = new Date()
): ScreenTimeEvaluation {
  if (!rules || !rules.enabled) {
    return {
      allowed: true,
      reason: 'disabled',
      usedMinutes,
      dailyLimitMinutes: rules?.daily_limit_minutes ?? null,
    }
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  // Prefer daily_limit over hours/bedtime when quota is exceeded.
  if (
    typeof rules.daily_limit_minutes === 'number' &&
    rules.daily_limit_minutes >= 0 &&
    usedMinutes >= rules.daily_limit_minutes
  ) {
    return {
      allowed: false,
      reason: 'daily_limit',
      message: 'You have reached your daily screen-time limit.',
      usedMinutes,
      dailyLimitMinutes: rules.daily_limit_minutes,
    }
  }

  const bedtimeStart = parseTimeToMinutes(rules.bedtime_start)
  const bedtimeEnd = parseTimeToMinutes(rules.bedtime_end)
  const inBedtime = isWithinTimeWindow(nowMinutes, bedtimeStart, bedtimeEnd)
  if (inBedtime === true) {
    return {
      allowed: false,
      reason: 'bedtime',
      message: 'It is currently bedtime for your account.',
      usedMinutes,
      dailyLimitMinutes: rules.daily_limit_minutes,
    }
  }

  const allowedStart = parseTimeToMinutes(rules.allowed_start_time)
  const allowedEnd = parseTimeToMinutes(rules.allowed_end_time)
  const inAllowed = isWithinTimeWindow(nowMinutes, allowedStart, allowedEnd)
  if (inAllowed === false) {
    return {
      allowed: false,
      reason: 'outside_allowed_hours',
      message: 'CribsTalk is only available during your allowed hours.',
      usedMinutes,
      dailyLimitMinutes: rules.daily_limit_minutes,
    }
  }

  return {
    allowed: true,
    usedMinutes,
    dailyLimitMinutes: rules.daily_limit_minutes,
  }
}
