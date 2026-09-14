import React from 'react'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon'
}

const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md',
  variant = 'full'
}) => {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8', 
    lg: 'h-10',
    xl: 'h-12'
  }

  const logoPath = '/assets/images/logo_2.png'
  const iconPath = '/assets/favicon-32x32.png'

  if (variant === 'icon') {
    return (
      <div className={`flex items-center ${className}`}>
        <img 
          src={iconPath}
          alt="CribsTalk"
          className={`${sizeClasses[size]} w-auto`}
          onError={(e) => {
            // Fallback to text logo if image fails to load
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const fallback = document.createElement('div')
            fallback.textContent = 'CT'
            fallback.className = `${sizeClasses[size]} w-8 bg-primary-600 text-white rounded-lg flex items-center justify-center font-bold text-sm`
            target.parentNode?.appendChild(fallback)
          }}
        />
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img 
        src={logoPath}
        alt="CribsTalk Logo"
        className={`${sizeClasses[size]} w-auto object-contain`}
        onError={(e) => {
          // Fallback to text logo if image fails to load
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          const fallback = document.createElement('div')
          fallback.className = 'flex items-center space-x-2'
          fallback.innerHTML = `
            <div class="w-10 h-10 bg-gradient-to-r from-african-green to-primary-600 text-white rounded-lg flex items-center justify-center font-bold text-lg">CT</div>
            <span class="font-bold text-2xl text-gray-900">CribsTalk</span>
          `
          target.parentNode?.appendChild(fallback)
        }}
      />
    </div>
  )
}

export default Logo