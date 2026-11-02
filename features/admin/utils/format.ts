import type { AdminProfileRef } from '@/lib/admin/contentAdminService'

export function formatAdminDate(dateString: string | null | undefined) {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function formatAdminProfile(profile: AdminProfileRef | null | undefined) {
  if (!profile) return '—'
  return profile.full_name || (profile.username ? `@${profile.username}` : '—')
}

export function formatAdminDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = seconds / 60
  if (mins < 60) return `${mins.toFixed(1)} min`
  return `${(mins / 60).toFixed(1)} hr`
}

export function formatSettingLabel(key: string) {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
