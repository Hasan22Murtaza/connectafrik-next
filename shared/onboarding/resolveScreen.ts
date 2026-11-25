import type { ScreenTourConfig } from './types'

/** Resolve the tour config for the current pathname (longest matching prefix wins). */
export function resolveScreenTour(
  pathname: string,
  tours: ScreenTourConfig[]
): ScreenTourConfig | null {
  const exact = tours.find((t) => t.exactPaths?.includes(pathname))
  if (exact) return exact

  let best: ScreenTourConfig | null = null
  let bestLen = -1

  for (const tour of tours) {
    for (const prefix of tour.pathPrefixes) {
      if (
        (pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
        prefix.length > bestLen
      ) {
        best = tour
        bestLen = prefix.length
      }
    }
  }

  return best
}
