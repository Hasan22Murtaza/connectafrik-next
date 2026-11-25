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
  pending_review: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  unverified: 'bg-surface-secondary text-content-secondary',
  accepted: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  declined: 'bg-red-500/10 text-red-700 dark:text-red-300',
  withdrawn: 'bg-surface-secondary text-content-secondary',
  cancelled: 'bg-surface-secondary text-content-secondary',
  paused: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  completed: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  invited: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  // Project stages
  concept: 'bg-surface-secondary text-content-secondary',
  feasibility: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  development: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  funding: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  construction: 'bg-orange-500/10 text-orange-800 dark:text-orange-200',
  operational: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  // Applications / enquiries
  responded: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-surface-secondary text-content-secondary',
  open: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  shortlisted: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  selected: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  awarded: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  // Agreements / events / tiers
  discussion: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  signed: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  signed_intent: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  registered: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  free: 'bg-surface-secondary text-content-secondary',
  standard: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  enterprise: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  in_progress: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  skipped: 'bg-surface-secondary text-content-secondary',
  comment: 'bg-surface-secondary text-content-secondary',
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
