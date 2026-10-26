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
  p.set('feed', 'following')
  return `?${p.toString()}`
}

/** Legacy URL — redirects to the shared watch feed */
export default async function FollowingFeedRedirect({ searchParams }: Props) {
  const sp = await searchParams
  redirect(`/reels/feed${toQuery(sp)}`)
}
