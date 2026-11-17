import React from 'react'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** `full` = icon + CribsTalk wordmark; `icon` = logo mark only */
  variant?: 'full' | 'icon'
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
} as const

const wordmarkClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
} as const

/** Icon-only mark (no baked-in wordmark — safe for light & dark). */
const ICON_SRC = '/assets/logo.png'

const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
}) => {
  const showWordmark = variant === 'full'

  return (
    <div className={`flex items-center ${showWordmark ? 'gap-2' : ''} ${className}`}>
      <img
        src={ICON_SRC}
        alt={showWordmark ? '' : 'CribsTalk'}
        aria-hidden={showWordmark}
        className={`${sizeClasses[size]} shrink-0 object-contain`}
        draggable={false}
      />
      {showWordmark && (
        <span
          className={`font-bold leading-none tracking-tight ${wordmarkClasses[size]}`}
          aria-label="CribsTalk"
        >
          {/* Light: dark Cribs; Dark: white Cribs. Talk stays brand orange. */}
          <span className="text-content dark:text-white">Cribs</span>
          <span className="text-primary">Talk</span>
        </span>
      )}
    </div>
  )
}

export default Logo
