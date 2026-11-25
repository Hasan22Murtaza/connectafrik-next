'use client'

const TONE: Record<string, string> = {
  verified: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  submitted: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  under_review: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  additional_info_required: 'bg-orange-500/10 text-orange-800 dark:text-orange-200',
  draft: 'bg-surface-secondary text-content-secondary',
  rejected: 'bg-red-500/10 text-red-700 dark:text-red-300',
  published: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  pending: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  accepted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  declined: 'bg-red-500/10 text-red-700 dark:text-red-300',
  withdrawn: 'bg-surface-secondary text-content-secondary',
  cancelled: 'bg-surface-secondary text-content-secondary',
  paused: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  completed: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  invited: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
}

export default function StatusBadge({ status }: { status: string }) {
  const tone = TONE[status] || 'bg-surface-secondary text-content-secondary'
  const label = status.replace(/_/g, ' ')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tone}`}
    >
      {label}
    </span>
  )
}
