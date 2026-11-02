import { Suspense } from 'react'
import { FeedInner } from './FeedInner'

function Fallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-white">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-[var(--african-orange)]"
        aria-hidden
      />
    </div>
  )
}

export default function ReelsFeedPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <FeedInner />
    </Suspense>
  )
}
