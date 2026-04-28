import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import type { ProfileLocationValue } from '@/shared/types/location'
import { parseGoogleAddressComponents } from '@/shared/utils/parseGoogleAddressComponents'

/** Prefer `GOOGLE_MAPS_API_KEY` on the server (IP-restricted); fallback to public key. Referrer-locked keys often fail from API routes. */
function mapsKey(): string | null {
  const k =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  return k || null
}

type AutocompletePrediction = {
  description: string
  place_id: string
}

type AutocompleteResponse = {
  predictions?: AutocompletePrediction[]
  status: string
  error_message?: string
}

type DetailsResponse = {
  result?: {
    formatted_address?: string
    address_components?: { long_name: string; short_name: string; types: string[] }[]
  }
  status: string
  error_message?: string
}

/**
 * GET /api/location-search?q=&sessionToken= — Place Autocomplete (legacy JSON).
 * GET /api/location-search?placeId=&sessionToken= — Place Details → structured location.
 */
export async function GET(request: NextRequest) {
  try {
    const key = mapsKey()
    if (!key) {
      return errorResponse(
        'Google Maps API key is not configured (set GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)',
        503
      )
    }

    const placeId = request.nextUrl.searchParams.get('placeId')?.trim() ?? ''
    const sessionToken = request.nextUrl.searchParams.get('sessionToken')?.trim() ?? ''

    if (placeId) {
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
      url.searchParams.set('place_id', placeId)
      url.searchParams.set('fields', 'formatted_address,address_component')
      url.searchParams.set('key', key)
      if (sessionToken) url.searchParams.set('sessiontoken', sessionToken)

      const res = await fetch(url.toString(), { cache: 'no-store' })
      const data = (await res.json()) as DetailsResponse

      if (data.status !== 'OK' || !data.result) {
        return errorResponse(data.error_message || `Place details failed: ${data.status}`, 400)
      }

      const formatted = (data.result.formatted_address || '').trim()
      const parsed = parseGoogleAddressComponents(data.result.address_components)

      const details: ProfileLocationValue = {
        formattedAddress: formatted,
        // Persist full Places line in `address` so reload matches the picker (establishment + route + area).
        address: formatted,
        city: parsed.city,
        state: parsed.state,
        zipcode: parsed.zipcode,
        country: parsed.country,
      }

      return jsonResponse({ details })
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) {
      return jsonResponse({ results: [] as { label: string; placeId: string }[] })
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
    url.searchParams.set('input', q)
    url.searchParams.set('key', key)
    if (sessionToken) url.searchParams.set('sessiontoken', sessionToken)

    const res = await fetch(url.toString(), { cache: 'no-store' })
    const data = (await res.json()) as AutocompleteResponse

    if (data.status === 'ZERO_RESULTS') {
      return jsonResponse({ results: [] })
    }

    if (data.status !== 'OK') {
      return errorResponse(data.error_message || `Autocomplete failed: ${data.status}`, 400)
    }

    const results = (data.predictions || []).map((p) => ({
      label: p.description,
      placeId: p.place_id,
    }))

    return jsonResponse({ results })
  } catch (e: any) {
    return errorResponse(e?.message || 'Location search error', 500)
  }
}
