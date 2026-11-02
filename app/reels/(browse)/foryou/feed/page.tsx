import { redirect } from 'next/navigation'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function toQuery(searchParams: Record<string, string | string[] | undefined>) {
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      value.forEach((v) => p.append(key, v))
    } else {
      p.set(key, value)
    }
  }
  // foryou is the default on /reels/feed — omit feed= for a cleaner URL
  p.delete('feed')
  const q = p.toString()
  return q ? `?${q}` : ''
}

/** Legacy URL — redirects to the shared watch feed */
export default async function ForYouFeedRedirect({ searchParams }: Props) {
  const sp = await searchParams
  redirect(`/reels/feed${toQuery(sp)}`)
}
