/**
 * Culture subcategories used for tagging culture posts.
 * Stored in posts.tags (e.g. ["traditional_music"]).
 */
export const CULTURE_SUBCATEGORIES = [
  { slug: 'traditional_music', name: 'Traditional Music', icon: '🎵', description: 'Songs, instruments, and rhythms' },
  { slug: 'cuisine_food', name: 'Cuisine & Food', icon: '🍲', description: 'Traditional dishes and cooking' },
  { slug: 'fashion_textiles', name: 'Fashion & Textiles', icon: '👗', description: 'Traditional clothing and designs' },
  { slug: 'art_crafts', name: 'Art & Crafts', icon: '🎨', description: 'Visual arts and handicrafts' },
  { slug: 'festivals_celebrations', name: 'Festivals & Celebrations', icon: '🎉', description: 'Cultural events and traditions' },
  { slug: 'languages_literature', name: 'Languages & Literature', icon: '📚', description: 'Stories, poems, and languages' },
] as const

export type CultureSubcategorySlug = typeof CULTURE_SUBCATEGORIES[number]['slug']

export function getCultureSubcategoryBySlug(slug: string) {
  return CULTURE_SUBCATEGORIES.find(c => c.slug === slug)
}
