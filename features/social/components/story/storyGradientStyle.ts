import type React from 'react'
import { colorsFromGradientString } from '@/features/social/services/storyApiCodec'

/** Facebook-style text story background: prefer hex color array, then "c1,c2" string, then solid fallback. */
export function storyTextBackgroundStyle(
  gradientColors: string[] | null | undefined,
  gradientString: string | null | undefined,
  fallbackColor: string
): React.CSSProperties {
  if (Array.isArray(gradientColors) && gradientColors.length >= 2) {
    return {
      backgroundImage: `linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]})`,
    }
  }
  const fromString = colorsFromGradientString(gradientString || undefined)
  if (fromString) {
    return {
      backgroundImage: `linear-gradient(135deg, ${fromString[0]}, ${fromString[1]})`,
    }
  }
  return { backgroundColor: fallbackColor }
}
