export interface PostLocationData {
  place_id?: string
  display_name: string
  map_title?: string
  country?: string
  region_label?: string
  latitude?: number
  longitude?: number
}

/** Serialize a selected place for `posts.location` (JSON when coords are known). */
export function serializePostLocation(place: {
  name: string
  address?: string
  lat?: number
  lng?: number
}): string {
  const lat = place.lat
  const lng = place.lng
  const hasCoords =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  if (hasCoords) {
    return JSON.stringify({
      display_name: place.name,
      latitude: lat,
      longitude: lng,
      ...(place.address?.trim() ? { map_title: place.address.trim() } : {}),
    } satisfies PostLocationData)
  }
  return place.name
}

/** Parse `posts.location` — JSON object string or legacy plain-text place name. */
export function parsePostLocation(
  raw: string | null | undefined
): PostLocationData | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      const display =
        typeof parsed.display_name === 'string'
          ? parsed.display_name
          : typeof parsed.name === 'string'
            ? parsed.name
            : null
      if (!display) return null
      return {
        place_id:
          typeof parsed.place_id === 'string' ? parsed.place_id : undefined,
        display_name: display,
        map_title:
          typeof parsed.map_title === 'string' ? parsed.map_title : undefined,
        country:
          typeof parsed.country === 'string' ? parsed.country : undefined,
        region_label:
          typeof parsed.region_label === 'string'
            ? parsed.region_label
            : undefined,
        latitude:
          typeof parsed.latitude === 'number' ? parsed.latitude : undefined,
        longitude:
          typeof parsed.longitude === 'number' ? parsed.longitude : undefined,
      }
    } catch {
      return { display_name: trimmed }
    }
  }
  return { display_name: trimmed }
}

export function getPostLocationMapsUrl(location: PostLocationData): string {
  if (
    location.latitude != null &&
    location.longitude != null &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.display_name)}`
}

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export function getPostLocationStaticMapUrl(
  location: PostLocationData,
  width = 600,
  height = 280
): string | null {
  const lat = location.latitude
  const lng = location.longitude
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null
  }
  if (GOOGLE_MAPS_API_KEY) {
    const marker = `color:red%7C${lat},${lng}`
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=${width}x${height}&scale=2&markers=${marker}&key=${GOOGLE_MAPS_API_KEY}`
  }
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=${width}x${height}&markers=${lat},${lng},red-pushpin`
}

export function getPostLocationCategoryLabel(
  location: PostLocationData
): string | null {
  if (location.region_label?.trim()) {
    return location.region_label.trim().toUpperCase()
  }
  if (location.country?.trim()) {
    return location.country.trim().toUpperCase()
  }
  return null
}
