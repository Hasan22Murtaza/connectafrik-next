/** Values for profile / signup: structured columns persist; `address` holds full Places line when picked. */
export type ProfileLocationValue = {
  /** Same as `address` when chosen from Places; drives the search input. */
  formattedAddress: string
  /** Full `formatted_address` from Google when using search; city/state/zip/country still parsed separately. */
  address: string
  city: string
  state: string
  zipcode: string
  country: string
}

export const emptyProfileLocation = (): ProfileLocationValue => ({
  formattedAddress: '',
  address: '',
  city: '',
  state: '',
  zipcode: '',
  country: '',
})

/** Secondary line: city + state. */
export function buildProfileLocationLine(city: string, state: string): string {
  return [city, state].map((s) => s.trim()).filter(Boolean).join(', ')
}

/** Single-line display from structured fields. */
export function buildStructuredLocationLine(parts: {
  address?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
  country?: string | null
}): string {
  const st = `${parts.state ?? ''}`.trim()
  return [parts.address, parts.city, st, parts.zipcode, parts.country]
    .map((s) => (typeof s === 'string' ? s.trim() : String(s ?? '').trim()))
    .filter(Boolean)
    .join(', ')
}

/**
 * One line to show in UI: prefer stored full Places string in `address` when it clearly matches,
 * otherwise compose from parts (legacy short `address` rows).
 */
export function getProfileLocationDisplayLine(row: {
  location?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
}): string {
  const loc = row.location?.trim() || ''
  if (loc) return loc

  const address = row.address?.trim() || ''
  const city = row.city?.trim() || ''
  const country = row.country?.trim() || ''

  const commaCount = (address.match(/,/g) || []).length
  const looksLikeFullPlacesLine =
    address.length > 0 &&
    ((city && address.includes(city)) ||
      (country && address.includes(country)) ||
      commaCount >= 3)

  if (looksLikeFullPlacesLine) return address

  const composed = buildStructuredLocationLine({
    address,
    city,
    state: row.state,
    zipcode: row.zipcode,
    country,
  })
  return composed || address
}

/** Hydrate from DB. */
export function profileLocationFromDb(row: {
  location?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
}): ProfileLocationValue {
  const country = row.country?.trim() || ''
  const city = row.city?.trim() || ''
  const state = row.state?.trim() || ''
  const address = row.address?.trim() || ''
  const zipcode = row.zipcode?.trim() || ''
  const formatted = getProfileLocationDisplayLine(row)
  return { formattedAddress: formatted, address, city, state, zipcode, country }
}
