'use client'

import React, { useEffect, useId, useRef, useState, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { emptyProfileLocation, type ProfileLocationValue } from '@/shared/types/location'

type Prediction = { label: string; placeId: string }

export type LocationSearchProps = {
  value: ProfileLocationValue
  onChange: (next: ProfileLocationValue) => void
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
  fieldClassName?: string
}

const defaultFieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]'

/**
 * Single visible search field. Choosing a suggestion loads Place Details and calls `onChange`
 * with full structured data (address, city, state, zipcode, country, formattedAddress) for the parent to persist.
 */
export const LocationSearch: React.FC<LocationSearchProps> = ({
  value,
  onChange,
  label = 'Location',
  required = false,
  disabled = false,
  className = '',
  fieldClassName = defaultFieldClass,
}) => {
  const idBase = useId()
  const sessionTokenRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  )
  const [query, setQuery] = useState(value.formattedAddress)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Prediction[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setQuery(value.formattedAddress)
  }, [value.formattedAddress])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const res = await apiClient.get<{ results: Prediction[] }>('/api/location-search', {
        q: q.trim(),
        sessionToken: sessionTokenRef.current,
      })
      setSuggestions(Array.isArray(res.results) ? res.results : [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  const pick = async (p: Prediction) => {
    setLoading(true)
    setOpen(false)
    try {
      const res = await apiClient.get<{ details: ProfileLocationValue }>('/api/location-search', {
        placeId: p.placeId,
        sessionToken: sessionTokenRef.current,
      })
      if (res.details) {
        onChange(res.details)
        setQuery(res.details.formattedAddress)
      }
      sessionTokenRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
    } catch {
      onChange({
        ...emptyProfileLocation(),
        formattedAddress: p.label,
      })
      setQuery(p.label)
    } finally {
      setLoading(false)
      setSuggestions([])
    }
  }

  const onInputChange = (text: string) => {
    setQuery(text)
    setOpen(true)
    onChange({
      ...emptyProfileLocation(),
      formattedAddress: text,
    })
  }

  return (
    <div ref={wrapRef} className={`space-y-1 ${className}`}>
      {label ? (
        <label className="flex items-center text-xs text-gray-600 mb-0.5" htmlFor={`${idBase}-search`}>
          {label}
          {required ? <span className="text-red-500 ml-0.5">*</span> : null}
        </label>
      ) : null}

      <div className="relative">
        <input
          id={`${idBase}-search`}
          type="search"
          autoComplete="off"
          disabled={disabled}
          value={query}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search for an address or place…"
          className={`${fieldClassName} pl-9`}
          required={required}
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        ) : null}

        {open && suggestions.length > 0 ? (
          <ul
            className="absolute z-50 mt-1 w-full max-h-52 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm"
            role="listbox"
          >
            {suggestions.map((s, i) => (
              <li key={`${s.placeId}-${i}`}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 focus:bg-orange-50 focus:outline-none"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pick(s)}
                >
                  <span className="text-gray-900 line-clamp-2">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

    </div>
  )
}

export default LocationSearch
