'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { X } from '@/shared/icons'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import { GSCH_CARD, GSCH_CHIP, GSCH_SELECT } from '@/features/gsch/constants/styles'
import { GSCH_CONTINENTS } from '@/shared/types/gsch'
import type { GschCity, GschMapConnection } from '@/shared/types/gsch'
import {
  hasGoogleMapsApiKey,
  loadGoogleMaps,
} from '@/shared/utils/loadGoogleMaps'
import { apiClient } from '@/lib/api-client'
import type { GschPaginated } from '@/shared/types/gsch'

type MapCity = Pick<
  GschCity,
  | 'id'
  | 'name'
  | 'country'
  | 'continent'
  | 'state_province'
  | 'logo_url'
  | 'is_published'
  | 'latitude'
  | 'longitude'
> & {
  organization?: {
    verification_status?: string | null
    verification_badge?: string | null
  } | null
  partnership_count?: number
}

type ResolvedCity = MapCity & { lat: number; lng: number }

type MapLink = Pick<
  GschMapConnection,
  'id' | 'from_city_id' | 'to_city_id' | 'kind' | 'label'
>

const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

function cacheKey(city: MapCity) {
  return `${city.name}|${city.state_province || ''}|${city.country}`.toLowerCase()
}

async function resolveCityCoords(
  maps: typeof google.maps,
  city: MapCity
): Promise<ResolvedCity | null> {
  if (
    city.latitude != null &&
    city.longitude != null &&
    Number.isFinite(Number(city.latitude)) &&
    Number.isFinite(Number(city.longitude))
  ) {
    return {
      ...city,
      lat: Number(city.latitude),
      lng: Number(city.longitude),
    }
  }

  const key = cacheKey(city)
  if (geocodeCache.has(key)) {
    const cached = geocodeCache.get(key)
    return cached ? { ...city, ...cached } : null
  }

  const query = [city.name, city.state_province, city.country].filter(Boolean).join(', ')
  if (!query.trim()) {
    geocodeCache.set(key, null)
    return null
  }

  try {
    const geocoder = new maps.Geocoder()
    const result = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          resolve(results)
        } else {
          resolve(null)
        }
      })
    })

    if (!result?.[0]?.geometry?.location) {
      geocodeCache.set(key, null)
      return null
    }

    const loc = result[0].geometry.location
    const coords = { lat: loc.lat(), lng: loc.lng() }
    geocodeCache.set(key, coords)
    return { ...city, ...coords }
  } catch {
    geocodeCache.set(key, null)
    return null
  }
}

function markerColor(city: MapCity) {
  return city.organization?.verification_status === 'verified' ? '#ea580c' : '#64748b'
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number) {
  return (rad * 180) / Math.PI
}

/** Spherical interpolation → curved great-circle path (flight-arc style). */
function greatCirclePath(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  steps = 64
): google.maps.LatLngLiteral[] {
  const lat1 = toRad(from.lat)
  const lng1 = toRad(from.lng)
  const lat2 = toRad(to.lat)
  const lng2 = toRad(to.lng)

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
      )
    )

  if (!Number.isFinite(d) || d < 1e-6) {
    return [from, to]
  }

  const path: google.maps.LatLngLiteral[] = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2)
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
    const lng = Math.atan2(y, x)
    path.push({ lat: toDeg(lat), lng: toDeg(lng) })
  }
  return path
}

function linkStroke(kind: MapLink['kind']) {
  if (kind === 'match') {
    return {
      strokeColor: '#0ea5e9',
      strokeOpacity: 0.75,
      strokeWeight: 2,
      icons: [
        {
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 0.85,
            scale: 3,
          },
          offset: '0',
          repeat: '12px',
        },
      ] as google.maps.IconSequence[],
    }
  }
  return {
    strokeColor: '#2563eb',
    strokeOpacity: 0.8,
    strokeWeight: 2.25,
    icons: [
      {
        icon: {
          path: 'M 0,-1 0,1',
          strokeOpacity: 0.9,
          scale: 3,
        },
        offset: '0',
        repeat: '14px',
      },
    ] as google.maps.IconSequence[],
  }
}

export default function GschWorldMap({
  cities,
  connections,
  autoLoadConnections = false,
  className = '',
}: {
  cities: MapCity[]
  connections?: MapLink[]
  /** When true and no connections prop, load active partnerships for mapped cities. */
  autoLoadConnections?: boolean
  className?: string
}) {
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const infoRef = useRef<google.maps.InfoWindow | null>(null)

  const [mapsReady, setMapsReady] = useState(false)
  const [mapsFailed, setMapsFailed] = useState(false)
  const [resolving, setResolving] = useState(true)
  const [resolved, setResolved] = useState<ResolvedCity[]>([])
  const [selected, setSelected] = useState<ResolvedCity | null>(null)
  const [continentFilter, setContinentFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [showRoutes, setShowRoutes] = useState(true)
  const [fetchedLinks, setFetchedLinks] = useState<MapLink[]>([])

  const countries = useMemo(() => {
    const set = new Set(cities.map((c) => c.country).filter(Boolean))
    return Array.from(set).sort()
  }, [cities])

  const filteredCities = useMemo(() => {
    return cities
      .filter((c) => (continentFilter ? c.continent === continentFilter : true))
      .filter((c) => (countryFilter ? c.country === countryFilter : true))
      .filter((c) =>
        verifiedOnly ? c.organization?.verification_status === 'verified' : true
      )
  }, [cities, continentFilter, countryFilter, verifiedOnly])

  const activeLinks = useMemo(() => {
    const source = connections && connections.length > 0 ? connections : fetchedLinks
    if (!showRoutes) return []
    const visible = new Set(filteredCities.map((c) => c.id))
    // Keep a link if at least one endpoint is visible; both must exist in resolved later
    return source.filter(
      (l) => visible.has(l.from_city_id) || visible.has(l.to_city_id)
    )
  }, [connections, fetchedLinks, filteredCities, showRoutes])

  // Optionally load public active partnerships for Discover / Cities map views
  useEffect(() => {
    if (!autoLoadConnections) return
    if (connections && connections.length > 0) return
    if (cities.length === 0) return

    let cancelled = false
    ;(async () => {
      try {
        const payload = await apiClient.get<
          GschPaginated<{
            id: string
            city_a_id: string | null
            city_b_id: string | null
            title?: string | null
            partnership_type?: string | null
          }>
        >('/api/gsch/partnerships', { mine: '0', status: 'active', limit: 50 })

        if (cancelled) return
        const cityIds = new Set(cities.map((c) => c.id))
        const links: MapLink[] = []
        for (const p of payload?.data || []) {
          if (!p.city_a_id || !p.city_b_id) continue
          if (!cityIds.has(p.city_a_id) && !cityIds.has(p.city_b_id)) continue
          links.push({
            id: `partnership-${p.id}`,
            from_city_id: p.city_a_id,
            to_city_id: p.city_b_id,
            kind: 'partnership',
            label: p.title || p.partnership_type || 'Partnership',
          })
        }
        setFetchedLinks(links)
      } catch {
        if (!cancelled) setFetchedLinks([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [autoLoadConnections, connections, cities])

  // Load Google Maps JS
  useEffect(() => {
    let cancelled = false
    if (!hasGoogleMapsApiKey()) {
      setMapsFailed(true)
      setResolving(false)
      return
    }

    loadGoogleMaps('places')
      .then((maps) => {
        if (cancelled) return
        if (!maps) {
          setMapsFailed(true)
          setResolving(false)
          return
        }
        setMapsReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setMapsFailed(true)
          setResolving(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Resolve coordinates (stored lat/lng or geocode)
  useEffect(() => {
    if (!mapsReady || typeof window === 'undefined' || !window.google?.maps) return

    let cancelled = false
    setResolving(true)
    setSelected(null)
    infoRef.current?.close()

    // Include cities needed as link endpoints even if filtered out visually
    // so arcs can still reach them when one side remains visible.
    const byId = new Map(cities.map((c) => [c.id, c]))
    const toResolve = new Map(filteredCities.map((c) => [c.id, c]))
    for (const link of activeLinks) {
      const a = byId.get(link.from_city_id)
      const b = byId.get(link.to_city_id)
      if (a) toResolve.set(a.id, a)
      if (b) toResolve.set(b.id, b)
    }

    ;(async () => {
      const maps = window.google.maps
      const results: ResolvedCity[] = []
      const list = Array.from(toResolve.values())
      const batchSize = 5
      for (let i = 0; i < list.length; i += batchSize) {
        if (cancelled) return
        const batch = list.slice(i, i + batchSize)
        const placed = await Promise.all(batch.map((c) => resolveCityCoords(maps, c)))
        for (const item of placed) {
          if (item) results.push(item)
        }
      }
      if (!cancelled) {
        setResolved(results)
        setResolving(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mapsReady, filteredCities, cities, activeLinks])

  // Init map once
  useEffect(() => {
    if (!mapsReady || !mapElRef.current || mapRef.current || !window.google?.maps) return

    const map = new window.google.maps.Map(mapElRef.current, {
      center: { lat: 20, lng: 10 },
      zoom: 2,
      minZoom: 2,
      maxZoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    })

    mapRef.current = map
    infoRef.current = new window.google.maps.InfoWindow()
    clustererRef.current = new MarkerClusterer({ map, markers: [] })
  }, [mapsReady])

  // Sync markers + connection arcs
  useEffect(() => {
    const map = mapRef.current
    const clusterer = clustererRef.current
    if (!map || !clusterer || !window.google?.maps) return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    clusterer.clearMarkers()

    polylinesRef.current.forEach((p) => p.setMap(null))
    polylinesRef.current = []

    if (resolved.length === 0) return

    const byId = new Map(resolved.map((c) => [c.id, c]))
    const visibleIds = new Set(filteredCities.map((c) => c.id))
    const bounds = new window.google.maps.LatLngBounds()

    // Draw city-to-city arcs first (under markers)
    for (const link of activeLinks) {
      const from = byId.get(link.from_city_id)
      const to = byId.get(link.to_city_id)
      if (!from || !to) continue

      const stroke = linkStroke(link.kind)
      const path = greatCirclePath(
        { lat: from.lat, lng: from.lng },
        { lat: to.lat, lng: to.lng },
        72
      )

      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: false,
        map,
        strokeColor: stroke.strokeColor,
        // dashed look via icons; base stroke nearly invisible
        strokeOpacity: 0,
        strokeWeight: stroke.strokeWeight,
        icons: stroke.icons,
        zIndex: 1,
      })

      polyline.addListener('click', () => {
        const mid = path[Math.floor(path.length / 2)]
        infoRef.current?.setContent(
          `<div style="font:12px/1.4 system-ui,sans-serif;padding:2px 4px;max-width:220px">
            <strong style="font-size:13px">${escapeHtml(from.name)} ↔ ${escapeHtml(to.name)}</strong><br/>
            <span style="color:#64748b">${escapeHtml(
              link.label || (link.kind === 'match' ? 'Recommended match' : 'Partnership')
            )}</span>
          </div>`
        )
        infoRef.current?.setPosition(mid)
        infoRef.current?.open({ map })
      })

      polylinesRef.current.push(polyline)
    }

    const markers = resolved
      .filter((city) => visibleIds.has(city.id))
      .map((city) => {
        const position = { lat: city.lat, lng: city.lng }
        bounds.extend(position)

        const marker = new window.google.maps.Marker({
          position,
          title: `${city.name}, ${city.country}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: markerColor(city),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          zIndex: 2,
        })

        marker.addListener('click', () => {
          setSelected(city)
          infoRef.current?.setContent(
            `<div style="font:12px/1.4 system-ui,sans-serif;padding:2px 4px;max-width:200px">
              <strong style="font-size:13px">${escapeHtml(city.name)}</strong><br/>
              <span style="color:#64748b">${escapeHtml(
                [city.country, city.continent].filter(Boolean).join(' · ')
              )}</span>
            </div>`
          )
          infoRef.current?.open({ map, anchor: marker })
          map.panTo(position)
          if ((map.getZoom() || 2) < 5) map.setZoom(5)
        })

        return marker
      })

    markersRef.current = markers
    clusterer.addMarkers(markers)

    if (markers.length === 1) {
      const only = markers[0].getPosition()
      if (only) {
        map.setCenter(only)
        map.setZoom(6)
      }
    } else if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 48)
      const zoom = map.getZoom()
      if (zoom != null && zoom > 8) map.setZoom(8)
    }
  }, [resolved, activeLinks, filteredCities])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
      polylinesRef.current.forEach((p) => p.setMap(null))
      polylinesRef.current = []
      clustererRef.current?.clearMarkers()
      clustererRef.current = null
      infoRef.current?.close()
      mapRef.current = null
    }
  }, [])

  const drawnLinkCount = useMemo(() => {
    if (!showRoutes) return 0
    const ids = new Set(resolved.map((c) => c.id))
    return activeLinks.filter(
      (l) => ids.has(l.from_city_id) && ids.has(l.to_city_id)
    ).length
  }, [activeLinks, resolved, showRoutes])

  return (
    <div className={`${GSCH_CARD} overflow-hidden p-0 ${className}`.trim()}>
      <div className="flex flex-col gap-4 border-b border-border/70 px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 shrink-0">
          <h2 className="text-base font-semibold tracking-tight text-content">
            Global city map
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-content-secondary">
            {resolving
              ? 'Locating cities…'
              : `${resolved.filter((c) => filteredCities.some((f) => f.id === c.id)).length} cities`}
            {drawnLinkCount > 0
              ? ` · ${drawnLinkCount} route${drawnLinkCount === 1 ? '' : 's'}`
              : ''}
            {' · '}click markers or routes for details
          </p>
        </div>
        <div className="flex flex-col gap-2.5 sm:items-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <select
              className={`${GSCH_SELECT} py-1.5 text-xs`}
              value={continentFilter}
              onChange={(e) => setContinentFilter(e.target.value)}
              aria-label="Filter by continent"
            >
              <option value="">All continents</option>
              {GSCH_CONTINENTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className={`${GSCH_SELECT} py-1.5 text-xs`}
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              aria-label="Filter by country"
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-content-secondary">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded border-border"
              />
              Verified only
            </label>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-content-secondary">
              <input
                type="checkbox"
                checked={showRoutes}
                onChange={(e) => setShowRoutes(e.target.checked)}
                className="rounded border-border"
              />
              Routes
            </label>
          </div>
        </div>
      </div>

      <div className="relative">
        {mapsFailed ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 bg-surface-secondary/40 px-6 text-center sm:h-80">
            <p className="text-sm font-medium text-content">Map unavailable</p>
            <p className="max-w-md text-xs text-content-secondary">
              Google Maps is not configured. Set{' '}
              <code className="rounded bg-surface-secondary px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{' '}
              to enable the interactive city map.
            </p>
          </div>
        ) : (
          <>
            <div
              ref={mapElRef}
              className="h-64 w-full bg-surface-secondary/30 sm:h-80 lg:h-[22rem]"
              role="region"
              aria-label="Interactive Google Map of participating cities"
            />
            {resolving ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : null}
            {!resolving && resolved.length === 0 && filteredCities.length > 0 ? (
              <div className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-lg border border-border bg-surface px-3 py-2 text-xs text-content-secondary shadow-sm">
                Could not locate these cities on the map. Add latitude/longitude to city profiles.
              </div>
            ) : null}
            {!resolving && filteredCities.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/60 px-4 text-center text-sm text-content-secondary">
                No cities match the current map filters.
              </div>
            ) : null}

            {!resolving && drawnLinkCount > 0 ? (
              <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 rounded-lg border border-border/80 bg-surface/95 px-2.5 py-2 text-[11px] text-content-secondary shadow-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 border-t-2 border-dashed border-[#2563eb]" />
                  Partnership
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 border-t-2 border-dashed border-[#0ea5e9]" />
                  Recommended match
                </span>
              </div>
            ) : null}
          </>
        )}

        {selected ? (
          <aside className="absolute bottom-3 right-3 z-20 w-[min(100%-1.5rem,18rem)] rounded-xl border border-border bg-surface p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-content">{selected.name}</p>
                <p className="mt-0.5 text-xs text-content-secondary">
                  {[selected.country, selected.continent].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-tertiary hover:bg-surface-secondary hover:text-content"
                onClick={() => {
                  setSelected(null)
                  infoRef.current?.close()
                }}
                aria-label="Close city panel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.organization?.verification_status ? (
                <StatusBadge status={selected.organization.verification_status} />
              ) : (
                <span className={GSCH_CHIP}>Unverified</span>
              )}
              {selected.partnership_count != null ? (
                <span className={GSCH_CHIP}>
                  {selected.partnership_count} partnership
                  {selected.partnership_count === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
            <Link
              href={`/global-hub/cities/${selected.id}`}
              className="btn-primary mt-4 inline-flex h-9 w-full items-center justify-center text-sm"
            >
              View city profile
            </Link>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
