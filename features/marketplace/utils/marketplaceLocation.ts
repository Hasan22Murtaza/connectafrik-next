import type { ProfileLocationValue } from '@/shared/types/location'
import { profileLocationFromDb } from '@/shared/types/location'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export const MARKETPLACE_LOCATION_STORAGE_KEY = 'marketplace-location-filter'

export const DEFAULT_MARKETPLACE_RADIUS_KM = 500

/** Fallback map center (West Africa) when no coordinates are available yet. */
export const DEFAULT_MAP_CENTER = { lat: 7.9465, lng: -1.0232 }

export const MARKETPLACE_RADIUS_OPTIONS = [
  { value: 10, label: '10 kilometers' },
  { value: 25, label: '25 kilometers' },
  { value: 50, label: '50 kilometers' },
  { value: 100, label: '100 kilometers' },
  { value: 250, label: '250 kilometers' },
  { value: 500, label: '500 kilometers' },
] as const

export type MarketplaceLocationFilter = {
  location: ProfileLocationValue
  radiusKm: number
}

export const emptyMarketplaceLocationFilter = (): MarketplaceLocationFilter => ({
  location: {
    formattedAddress: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    country: '',
    latitude: null,
    longitude: null,
  },
  radiusKm: DEFAULT_MARKETPLACE_RADIUS_KM,
})

export function getLocationDisplayLabel(location: ProfileLocationValue): string {
  const city = location.city?.trim()
  const country = location.country?.trim()
  if (city) return city
  if (country) return country
  const formatted = location.formattedAddress?.trim()
  if (formatted) {
    const first = formatted.split(',')[0]?.trim()
    return first || formatted
  }
  return 'Select location'
}

export function getLocationFilterChipLabel(
  location: ProfileLocationValue,
  radiusKm: number,
  showRadius = true
): string {
  const label = getLocationDisplayLabel(location)
  if (!showRadius) return label
  return `${label} · ${radiusKm} km`
}

export function marketplaceFilterFromProfile(profile: {
  country?: string | null
  city?: string | null
  address?: string | null
  state?: string | null
  zipcode?: string | null
  location?: string | null
} | null | undefined): MarketplaceLocationFilter {
  if (!profile?.country?.trim()) {
    return emptyMarketplaceLocationFilter()
  }
  return {
    location: profileLocationFromDb(profile),
    radiusKm: DEFAULT_MARKETPLACE_RADIUS_KM,
  }
}

export function hasValidCoordinates(location: ProfileLocationValue): boolean {
  const lat = location.latitude
  const lng = location.longitude
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  )
}

function circlePath(lat: number, lng: number, radiusKm: number, points = 48): string {
  const earthRadiusKm = 6371
  const coords: string[] = []
  for (let i = 0; i <= points; i++) {
    const angle = (i * 360) / points
    const bearing = (angle * Math.PI) / 180
    const latRad = (lat * Math.PI) / 180
    const lngRad = (lng * Math.PI) / 180
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(radiusKm / earthRadiusKm) +
        Math.cos(latRad) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(bearing)
    )
    const lng2 =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(latRad),
        Math.cos(radiusKm / earthRadiusKm) - Math.sin(latRad) * Math.sin(lat2)
      )
    coords.push(`${(lat2 * 180) / Math.PI},${(lng2 * 180) / Math.PI}`)
  }
  return coords.join('|')
}

function zoomForRadius(radiusKm: number): number {
  if (radiusKm <= 10) return 11
  if (radiusKm <= 25) return 10
  if (radiusKm <= 50) return 9
  if (radiusKm <= 100) return 8
  if (radiusKm <= 250) return 7
  return 6
}

export function getMarketplaceStaticMapUrlFromCoords(
  lat: number,
  lng: number,
  options?: {
    radiusKm?: number
    showRadiusCircle?: boolean
    width?: number
    height?: number
  }
): string {
  const radiusKm = options?.radiusKm ?? DEFAULT_MARKETPLACE_RADIUS_KM
  const showRadiusCircle = options?.showRadiusCircle ?? true
  const width = options?.width ?? 640
  const height = options?.height ?? 280

  const marker = `color:red%7C${lat},${lng}`
  const zoom = showRadiusCircle ? zoomForRadius(radiusKm) : 13
  const path = showRadiusCircle
    ? `&path=fillcolor:0x2563eb33|color:0x2563eb55|weight:2|${circlePath(lat, lng, radiusKm)}`
    : ''

  if (GOOGLE_MAPS_API_KEY) {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=2&markers=${marker}${path}&key=${GOOGLE_MAPS_API_KEY}`
  }

  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lng},red-pushpin`
}

export function getMarketplaceStaticMapUrl(
  location: ProfileLocationValue,
  radiusKm: number,
  width = 640,
  height = 280,
  showRadiusCircle = true
): string {
  const lat = hasValidCoordinates(location) ? location.latitude! : DEFAULT_MAP_CENTER.lat
  const lng = hasValidCoordinates(location) ? location.longitude! : DEFAULT_MAP_CENTER.lng

  return getMarketplaceStaticMapUrlFromCoords(lat, lng, {
    radiusKm,
    showRadiusCircle,
    width,
    height,
  })
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function readStoredMarketplaceFilter(): MarketplaceLocationFilter | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(MARKETPLACE_LOCATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MarketplaceLocationFilter
    if (!parsed?.location || typeof parsed.radiusKm !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredMarketplaceFilter(filter: MarketplaceLocationFilter): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MARKETPLACE_LOCATION_STORAGE_KEY, JSON.stringify(filter))
  } catch {
    // ignore quota errors
  }
}
