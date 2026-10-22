import { Suspense } from 'react'
import { ForYouFeedInner } from './ForYouFeedInner'

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

export default function ForYouFeedPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ForYouFeedInner />
    </Suspense>
  )
}
