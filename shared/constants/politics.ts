/**
 * Politics subcategories used for tagging politics posts.
 * Stored in posts.tags (e.g. ["democracy_governance"]).
 */
export const POLITICS_SUBCATEGORIES = [
  { slug: 'democracy_governance', name: 'Democracy & Governance', icon: '🏛️', description: 'Governance and democratic processes' },
  { slug: 'economic_development', name: 'Economic Development', icon: '📈', description: 'Economy and development policy' },
  { slug: 'youth_politics', name: 'Youth & Politics', icon: '👥', description: 'Youth engagement and representation' },
  { slug: 'continental_integration', name: 'Continental Integration', icon: '🌍', description: 'AU and regional integration' },
  { slug: 'education_policy', name: 'Education Policy', icon: '📚', description: 'Education and skills' },
  { slug: 'healthcare_systems', name: 'Healthcare Systems', icon: '🏥', description: 'Health policy and systems' },
] as const

export type PoliticsSubcategorySlug = typeof POLITICS_SUBCATEGORIES[number]['slug']

export function getPoliticsSubcategoryBySlug(slug: string) {
  return POLITICS_SUBCATEGORIES.find(c => c.slug === slug)
}
