import { Suspense } from 'react'
import { MemoriesExploreFeedInner } from './MemoriesExploreFeedInner'

function Fallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-neutral-100">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" aria-hidden />
    </div>
  )
}

export default function ExploreFeedPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <MemoriesExploreFeedInner />
    </Suspense>
  )
}
