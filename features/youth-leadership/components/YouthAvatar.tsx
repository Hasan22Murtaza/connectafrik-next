'use client'

const DEFAULT_AVATAR = '/assets/images/profile-dp.svg'

function initialsFromName(name?: string | null) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

export default function YouthAvatar({
  src,
  name,
  size = 'md',
  className = '',
}: {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClass =
    size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-10 w-10 text-xs'
  const url = (src || '').trim()

  if (url) {
    return (
      <img
        src={url}
        alt={name ? `${name} avatar` : 'Avatar'}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-border ${className}`}
        onError={(e) => {
          const img = e.currentTarget
          if (img.src.endsWith(DEFAULT_AVATAR)) return
          img.src = DEFAULT_AVATAR
        }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ring-1 ring-border ${className}`}
      title={name || undefined}
    >
      {initialsFromName(name)}
    </span>
  )
}
