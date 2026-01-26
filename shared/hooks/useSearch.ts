import { useState, useCallback, useRef, useEffect } from 'react'
import { searchService, type SearchResults, SEARCH_DEBOUNCE_MS, DEFAULT_MIN_QUERY_LENGTH } from '@/shared/services/searchService'

interface UseSearchOptions {
  debounceMs?: number
  minQueryLength?: number
}

interface UseSearchReturn {
  searchTerm: string
  searchResults: SearchResults | null
  isSearching: boolean
  handleSearch: (query: string) => void
  clearSearch: () => void
}

/**
 * Custom hook for search functionality
 * 
 * Features:
 * - Automatic debouncing
 * - Query validation
 * - Loading state management
 * - Cleanup on unmount
 * 
 * @param options - Configuration options
 * @returns Search state and handlers
 */
export const useSearch = (options: UseSearchOptions = {}): UseSearchReturn => {
  const {
    debounceMs = SEARCH_DEBOUNCE_MS,
    minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
  } = options

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Perform the actual search
   */
  const performSearch = useCallback(
    async (query: string) => {
      const normalizedQuery = query.trim()

      // Validate query length
      if (normalizedQuery.length < minQueryLength) {
        setSearchResults(null)
        setIsSearching(false)
        return
      }

      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController()

      setIsSearching(true)

      try {
        const results = await searchService.search(normalizedQuery, {
          minQueryLength,
        })

        // Only update if request wasn't aborted
        if (!abortControllerRef.current.signal.aborted) {
          setSearchResults(results)
        }
      } catch (error) {
        console.error('[useSearch] Search error:', error)
        if (!abortControllerRef.current?.signal.aborted) {
          setSearchResults(null)
        }
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsSearching(false)
        }
      }
    },
    [minQueryLength]
  )

  /**
   * Handle search input with debouncing
   */
  const handleSearch = useCallback(
    (query: string) => {
      setSearchTerm(query)

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // If query is too short, clear results immediately
      if (query.trim().length < minQueryLength) {
        setSearchResults(null)
        setIsSearching(false)
        return
      }

      // Debounce the search
      timeoutRef.current = setTimeout(() => {
        performSearch(query)
      }, debounceMs)
    },
    [debounceMs, minQueryLength, performSearch]
  )

  /**
   * Clear search state
   */
  const clearSearch = useCallback(() => {
    setSearchTerm('')
    setSearchResults(null)
    setIsSearching(false)

    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Abort pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    searchTerm,
    searchResults,
    isSearching,
    handleSearch,
    clearSearch,
  }
}

