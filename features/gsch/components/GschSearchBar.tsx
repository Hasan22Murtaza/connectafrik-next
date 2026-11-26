'use client'

import { Search, X } from '@/shared/icons'
import { GSCH_FIELD } from '@/features/gsch/constants/styles'

export default function GschSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search…',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  className?: string
}) {
  return (
    <form
      className={`relative min-w-0 flex-1 ${className}`.trim()}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      role="search"
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary"
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${GSCH_FIELD} pl-9 pr-9`}
        aria-label={placeholder}
      />
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-content-tertiary transition hover:bg-surface-secondary hover:text-content"
          onClick={() => {
            onChange('')
            onSubmit?.()
          }}
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ) : null}
    </form>
  )
}
