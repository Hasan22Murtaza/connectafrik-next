'use client'

const TONE: Record<string, string> = {
  published: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  verified: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  accepted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  completed: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  submitted: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  under_review: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  pending: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  pending_review: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  pending_approval: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  pending_guardian: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  waitlisted: 'bg-orange-500/10 text-orange-800 dark:text-orange-200',
  draft: 'bg-surface-secondary text-content-secondary',
  rejected: 'bg-red-500/10 text-red-700 dark:text-red-300',
  suspended: 'bg-red-500/10 text-red-700 dark:text-red-300',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-300',
  withdrawn: 'bg-surface-secondary text-content-secondary',
  scheduled: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
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
