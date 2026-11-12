'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function useYouthTab<T extends string>(
  validTabs: readonly T[],
  fallback: T,
  key = 'tab'
): [T, (next: T) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tab = useMemo(() => {
    const raw = searchParams.get(key)
    if (raw && (validTabs as readonly string[]).includes(raw)) {
      return raw as T
    }
    return fallback
  }, [searchParams, key, validTabs, fallback])

  const setTab = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === fallback) {
        params.delete(key)
      } else {
        params.set(key, next)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [fallback, key, pathname, router, searchParams]
  )

  return [tab, setTab]
}
