import type React from 'react'
import { colorsFromGradientString } from '@/features/social/services/storyApiCodec'

/**
 * Text/link story background.
 * Prefer the solid color the user chose; only use an explicit gradient when
 * `preferSolid` is false (legacy gradient text stories).
 */
export function storyTextBackgroundStyle(
  gradientColors: string[] | null | undefined,
  gradientString: string | null | undefined,
  fallbackColor: string,
  preferSolid = true
): React.CSSProperties {
  if (preferSolid) {
    return { backgroundColor: fallbackColor }
  }
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
