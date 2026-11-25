/**
 * Transparent weighted city match engine (weighted_v1).
 * Scores only real field overlap — never invents data or fake scores.
 */

export const GSCH_MATCH_ALGORITHM_VERSION = 'weighted_v1' as const

export const GSCH_MATCH_WEIGHTS = {
  collaboration_interests: 25,
  major_industries: 20,
  infrastructure_priorities: 15,
  tourism_assets: 10,
  education_institutions: 10,
  climate_renewable: 10,
  export_products: 5,
  different_country: 5,
} as const

export type GschMatchWeightKey = keyof typeof GSCH_MATCH_WEIGHTS

export type GschMatchScoreBreakdown = Record<
  string,
  { weight: number; overlap: number; score: number }
>

export type GschMatchCityInput = {
  id: string
  name?: string | null
  country?: string | null
  major_industries?: string[] | null
  tourism_assets?: string[] | null
  education_institutions?: string[] | null
  infrastructure_priorities?: string[] | null
  export_products?: string[] | null
  collaboration_interests?: string[] | null
  climate_objectives?: string | null
  renewable_energy_initiatives?: string | null
  is_published?: boolean
  interests?: Array<{ interest_slug?: string | null; interest_label?: string | null }> | null
}

export type GschMatchPairResult = {
  score: number
  shared_interests: string[]
  collaboration_areas: string[]
  score_breakdown: GschMatchScoreBreakdown
  explanation: string
}

export type GschMatchRecommendationResult = GschMatchPairResult & {
  source_city_id: string
  recommended_city_id: string
  recommended_city?: GschMatchCityInput
}

/** Lowercase, trim, dedupe tokens. Drops empty strings. */
export function normalizeTokens(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const t = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function tokenizeFreeText(...parts: Array<string | null | undefined>): string[] {
  const tokens: string[] = []
  for (const part of parts) {
    if (!part || !String(part).trim()) continue
    const chunks = String(part)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
    tokens.push(...chunks)
  }
  return normalizeTokens(tokens)
}

function interestTokens(city: GschMatchCityInput): string[] {
  const fromArray = city.collaboration_interests || []
  const fromInterests = (city.interests || [])
    .flatMap((i) => [i.interest_slug, i.interest_label])
    .filter(Boolean) as string[]
  return normalizeTokens([...fromArray, ...fromInterests])
}

function arrayOverlapScore(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
  weight: number
): { weight: number; overlap: number; score: number; shared: string[] } {
  const left = normalizeTokens(a || [])
  const right = normalizeTokens(b || [])
  if (left.length === 0 && right.length === 0) {
    return { weight, overlap: 0, score: 0, shared: [] }
  }
  const rightSet = new Set(right)
  const shared = left.filter((t) => rightSet.has(t))
  const unionSize = new Set([...left, ...right]).size
  const ratio = shared.length / Math.max(unionSize, 1)
  const score = weight * ratio
  return { weight, overlap: shared.length, score, shared }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function scoreCityPair(
  source: GschMatchCityInput,
  target: GschMatchCityInput
): GschMatchPairResult {
  const breakdown: GschMatchScoreBreakdown = {}
  const collaboration = arrayOverlapScore(
    interestTokens(source),
    interestTokens(target),
    GSCH_MATCH_WEIGHTS.collaboration_interests
  )
  breakdown.collaboration_interests = {
    weight: collaboration.weight,
    overlap: collaboration.overlap,
    score: round2(collaboration.score),
  }

  const industries = arrayOverlapScore(
    source.major_industries,
    target.major_industries,
    GSCH_MATCH_WEIGHTS.major_industries
  )
  breakdown.major_industries = {
    weight: industries.weight,
    overlap: industries.overlap,
    score: round2(industries.score),
  }

  const infra = arrayOverlapScore(
    source.infrastructure_priorities,
    target.infrastructure_priorities,
    GSCH_MATCH_WEIGHTS.infrastructure_priorities
  )
  breakdown.infrastructure_priorities = {
    weight: infra.weight,
    overlap: infra.overlap,
    score: round2(infra.score),
  }

  const tourism = arrayOverlapScore(
    source.tourism_assets,
    target.tourism_assets,
    GSCH_MATCH_WEIGHTS.tourism_assets
  )
  breakdown.tourism_assets = {
    weight: tourism.weight,
    overlap: tourism.overlap,
    score: round2(tourism.score),
  }

  const education = arrayOverlapScore(
    source.education_institutions,
    target.education_institutions,
    GSCH_MATCH_WEIGHTS.education_institutions
  )
  breakdown.education_institutions = {
    weight: education.weight,
    overlap: education.overlap,
    score: round2(education.score),
  }

  const climateA = tokenizeFreeText(
    source.climate_objectives,
    source.renewable_energy_initiatives
  )
  const climateB = tokenizeFreeText(
    target.climate_objectives,
    target.renewable_energy_initiatives
  )
  const climate = arrayOverlapScore(
    climateA,
    climateB,
    GSCH_MATCH_WEIGHTS.climate_renewable
  )
  breakdown.climate_renewable = {
    weight: climate.weight,
    overlap: climate.overlap,
    score: round2(climate.score),
  }

  const exports = arrayOverlapScore(
    source.export_products,
    target.export_products,
    GSCH_MATCH_WEIGHTS.export_products
  )
  breakdown.export_products = {
    weight: exports.weight,
    overlap: exports.overlap,
    score: round2(exports.score),
  }

  const sourceCountry = (source.country || '').trim().toLowerCase()
  const targetCountry = (target.country || '').trim().toLowerCase()
  let countryScore = 0
  let countryOverlap = 0
  if (sourceCountry && targetCountry && sourceCountry !== targetCountry) {
    countryScore = GSCH_MATCH_WEIGHTS.different_country
    countryOverlap = 1
  }
  breakdown.different_country = {
    weight: GSCH_MATCH_WEIGHTS.different_country,
    overlap: countryOverlap,
    score: round2(countryScore),
  }

  const total =
    collaboration.score +
    industries.score +
    infra.score +
    tourism.score +
    education.score +
    climate.score +
    exports.score +
    countryScore

  const score = round2(Math.min(100, Math.max(0, total)))

  const shared_interests = collaboration.shared
  const collaboration_areas = normalizeTokens([
    ...collaboration.shared,
    ...industries.shared,
  ])

  const topDims = Object.entries(breakdown)
    .filter(([, v]) => v.overlap > 0 && v.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 4)
    .map(([key, v]) => `${key.replace(/_/g, ' ')} (${v.overlap} overlap, ${v.score.toFixed(2)} pts)`)

  const explanation =
    topDims.length === 0
      ? 'No overlapping profile data between these cities.'
      : `Top overlaps: ${topDims.join('; ')}.`

  return {
    score,
    shared_interests,
    collaboration_areas,
    score_breakdown: breakdown,
    explanation,
  }
}

/**
 * Light opportunity affinity helper — secondary insight only.
 * Scores overlap between a city's interest/industry tokens and opportunity tags.
 * Returns 0–100; never invents tags.
 */
export function scoreOpportunityAffinity(
  city: GschMatchCityInput,
  opportunityTagsOrInterests: string[] | null | undefined
): { score: number; shared: string[] } {
  const cityTokens = normalizeTokens([
    ...interestTokens(city),
    ...(city.major_industries || []),
    ...(city.infrastructure_priorities || []),
    ...(city.tourism_assets || []),
    ...(city.collaboration_interests || []),
  ])
  const oppTokens = normalizeTokens(opportunityTagsOrInterests || [])
  if (cityTokens.length === 0 || oppTokens.length === 0) {
    return { score: 0, shared: [] }
  }
  const oppSet = new Set(oppTokens)
  const shared = cityTokens.filter((t) => oppSet.has(t))
  if (shared.length === 0) return { score: 0, shared: [] }
  const ratio = shared.length / Math.max(new Set([...cityTokens, ...oppTokens]).size, 1)
  return { score: round2(Math.min(100, ratio * 100)), shared }
}

export function computeRecommendationsForCity(
  sourceCity: GschMatchCityInput,
  candidates: GschMatchCityInput[],
  limit = 20
): GschMatchRecommendationResult[] {
  const results: GschMatchRecommendationResult[] = []

  for (const candidate of candidates) {
    if (!candidate?.id || candidate.id === sourceCity.id) continue
    if (candidate.is_published === false) continue

    const pair = scoreCityPair(sourceCity, candidate)
    if (pair.score <= 0) continue

    results.push({
      ...pair,
      source_city_id: sourceCity.id,
      recommended_city_id: candidate.id,
      recommended_city: candidate,
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, Math.max(0, limit))
}
