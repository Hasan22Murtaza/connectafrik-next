import type { ReelFeedType } from '@/shared/types/reels'

/** Build the shared reel watch URL: `/reels/feed?start=…` */
export function reelsFeedHref(opts: {
  start: string
  feed?: ReelFeedType | null
  category?: string | null
}): string {
  const p = new URLSearchParams()
  // foryou is the default — omit feed= for a cleaner URL
  if (opts.feed && opts.feed !== 'foryou') p.set('feed', opts.feed)
  if (opts.category) p.set('category', opts.category)
  p.set('start', opts.start)
  return `/reels/feed?${p.toString()}`
}
