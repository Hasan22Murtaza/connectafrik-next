import { Suspense } from 'react'
import { ReelsExploreFeedInner } from './ReelsExploreFeedInner'

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

export default function ExploreFeedPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ReelsExploreFeedInner />
    </Suspense>
  )
}
