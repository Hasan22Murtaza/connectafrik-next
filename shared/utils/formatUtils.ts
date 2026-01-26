/**
 * Utility function to format large numbers (e.g., 1500 -> "1.5K")
 */
export const formatCount = (count: number | null): string => {
  if (!count || count === 0) return '0'
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

