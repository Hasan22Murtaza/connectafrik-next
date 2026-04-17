/**
 * Seeded, WhatsApp-style gaps between feed posts for inline widgets (People you may know, Reels strip).
 * Stable for the same seed + post count so infinite scroll does not reshuffle.
 */

export const PYMK_FIRST_GAP_MIN = 10
export const PYMK_FIRST_GAP_MAX = 40
export const PYMK_BETWEEN_GAP_MIN = 15
export const PYMK_BETWEEN_GAP_MAX = 50

/** Slightly different default range so Reels often lands away from PYMK. */
export const REELS_FIRST_GAP_MIN = 7
export const REELS_FIRST_GAP_MAX = 32
export const REELS_BETWEEN_GAP_MIN = 12
export const REELS_BETWEEN_GAP_MAX = 44

function hashSeed(seed: string): number {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(initial: number): () => number {
  let a = initial
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rngInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** 0-based post index after which the widget is shown. */
function computeSlotsForRanges(
  postCount: number,
  seed: string,
  firstMin: number,
  firstMax: number,
  betweenMin: number,
  betweenMax: number
): number[] {
  if (postCount <= 0) return []

  const rng = mulberry32(hashSeed(seed))
  const slots: number[] = []
  let afterIndex = rngInt(rng, firstMin, firstMax) - 1

  while (afterIndex < postCount) {
    slots.push(afterIndex)
    afterIndex += rngInt(rng, betweenMin, betweenMax)
  }

  return slots
}

export function computePeopleYouMayKnowSlots(postCount: number, seed: string): number[] {
  return computeSlotsForRanges(
    postCount,
    seed,
    PYMK_FIRST_GAP_MIN,
    PYMK_FIRST_GAP_MAX,
    PYMK_BETWEEN_GAP_MIN,
    PYMK_BETWEEN_GAP_MAX
  )
}

export function getPeopleYouMayKnowInsertAfterIndex(postCount: number, seed: string): number | null {
  const slots = computePeopleYouMayKnowSlots(postCount, seed)
  return slots.length > 0 ? slots[0]! : null
}

export function computeReelsStripSlots(postCount: number, seed: string): number[] {
  return computeSlotsForRanges(
    postCount,
    seed,
    REELS_FIRST_GAP_MIN,
    REELS_FIRST_GAP_MAX,
    REELS_BETWEEN_GAP_MIN,
    REELS_BETWEEN_GAP_MAX
  )
}

/** First reels slot; if it matches `avoidAfterIndex`, use the next slot in the sequence. */
export function getReelsStripInsertAfterIndex(
  postCount: number,
  seed: string,
  avoidAfterIndex: number | null
): number | null {
  const reelsSeed = `${seed}|reels-v1`
  const slots = computeReelsStripSlots(postCount, reelsSeed)
  if (slots.length === 0) return null
  if (avoidAfterIndex === null) return slots[0]!

  const next = slots.find((s) => s !== avoidAfterIndex)
  if (next !== undefined) return next

  const rng = mulberry32(hashSeed(`${seed}|reels-bump`))
  const bump = rngInt(rng, REELS_BETWEEN_GAP_MIN, REELS_BETWEEN_GAP_MAX)
  const candidate = avoidAfterIndex + bump
  return candidate < postCount ? candidate : null
}

export type ResolvedFeedInlineIndices = {
  pymkAfterIndex: number | null
  reelsAfterIndex: number | null
}

export function getResolvedFeedInlineIndices(
  postCount: number,
  seedBase: string,
  options: { pymk: boolean }
): ResolvedFeedInlineIndices {
  const pymkSeed = `${seedBase}|pymk-v1`
  const pymkAfterIndex = options.pymk ? getPeopleYouMayKnowInsertAfterIndex(postCount, pymkSeed) : null

  const reelsAfterIndex = getReelsStripInsertAfterIndex(postCount, seedBase, pymkAfterIndex)

  return { pymkAfterIndex, reelsAfterIndex }
}
