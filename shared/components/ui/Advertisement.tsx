import React, { useState } from 'react'
import { X, ExternalLink } from 'lucide-react'

interface AdProps {
  type: 'banner' | 'native' | 'sidebar'
  placement: string
  className?: string
}

interface AdData {
  id: string
  title: string
  description: string
  imageUrl: string
  clickUrl: string
  advertiser: string
  cta: string
}

// Mock ad data - in production, this would come from an ad server
const mockAds: AdData[] = [
  {
    id: '1',
    title: 'Build your own AI Agent!',
    description: 'Launch custom AI assistants in minutes with ODIN\'s no-code agent builder.',
    imageUrl: '/assets/images/odin.png',
    clickUrl: 'https://getodin.ai/',
    advertiser: 'ODIN',
    cta: 'Get Started'
  },
  {
    id: '2',
    title: 'Discover African Fashion',
    description: 'Shop authentic African clothing and accessories from local designers across the continent.',
    imageUrl: '/assets/images/odin.png',
    clickUrl: 'https://ajabeng.com/',
    advertiser: 'AfriStyle',
    cta: 'Shop Now'
  },
  {
    id: '3',
    title: 'Learn Swahili Online',
    description: 'Connect with your African roots through language. Start your Swahili journey today.',
    imageUrl: '/assets/images/odin.png',
    clickUrl: 'https://www.duolingo.com/course/sw/en/Learn-Swahili',
    advertiser: 'AfriLanguages',
    cta: 'Start Learning'
  },
  {
    id: '4',
    title: 'Invest in African Startups',
    description: 'Support the next generation of African entrepreneurs and get returns on your investment.',
    imageUrl: '/assets/images/odin.png',
    clickUrl: 'https://www.ajimcapital.com/',
    advertiser: 'Ajim Capital',
    cta: 'Learn More'
  }
]

const Advertisement: React.FC<AdProps> = ({ type, placement, className = '' }) => {
  const [isVisible, setIsVisible] = useState(true)
  const [currentAdIndex] = useState(Math.floor(Math.random() * mockAds.length))
  
  if (!isVisible) return null
  
  const ad = mockAds[currentAdIndex]
  
  const handleAdClick = () => {
    // Track ad click analytics
    console.log(`Ad clicked: ${ad.id} at ${placement}`)
    
    // Handle different URL types
    if (ad.clickUrl && ad.clickUrl !== '#') {
      if (ad.clickUrl.startsWith('tel:')) {
        // Handle phone numbers - open phone dialer
        window.location.href = ad.clickUrl
      } else {
        // Handle web URLs - open in new tab
        window.open(ad.clickUrl, '_blank', 'noopener,noreferrer')
      }
    }
    
    // In production, this would track clicks and handle attribution
  }
  
  const handleAdClose = () => {
    setIsVisible(false)
    // Track ad dismissal
    console.log(`Ad dismissed: ${ad.id} at ${placement}`)
  }

  // Banner ad (top of page)
  if (type === 'banner') {
    return (
      <div className={`bg-gradient-to-r from-african-green to-primary-600 text-white py-3 px-4 ${className}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-xs bg-white/20 px-2 py-1 rounded">Sponsored</span>
            <span className="font-medium">{ad.title}</span>
            <span className="text-green-100 hidden md:block">{ad.description}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAdClick}
              className="bg-white text-primary-600 px-4 py-1 rounded font-medium text-sm hover:bg-gray-100 transition-colors"
            >
              {ad.cta}
            </button>
            <button
              onClick={handleAdClose}
              className="text-white/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Native ad (in feed)
  if (type === 'native') {
    return (
      <article className={`card mb-6 border-l-4 border-yellow-400 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
            Sponsored Content
          </span>
          <button
            onClick={handleAdClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex space-x-4">
          <img
            src={ad.imageUrl}
            alt={ad.title}
            className="w-24 h-24 object-cover rounded-lg"
            onError={(e) => {
              // Fallback image
              const target = e.target as HTMLImageElement
              target.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="%23f3f4f6"/><text x="48" y="52" text-anchor="middle" fill="%236b7280" font-family="Arial" font-size="12">Ad Image</text></svg>`
            }}
          />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">{ad.title}</h3>
            <p className="text-gray-600 text-sm mb-3">{ad.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">by {ad.advertiser}</span>
              <button
                onClick={handleAdClick}
                className="flex items-center space-x-1 bg-primary-600 text-white px-3 py-1 rounded text-sm hover:bg-primary-700 transition-colors"
              >
                <span>{ad.cta}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </article>
    )
  }

  // Sidebar ad
  if (type === 'sidebar') {
    return (
      <div className={`card max-w-sm ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">
            Sponsored
          </span>
          <button
            onClick={handleAdClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <img
          src={ad.imageUrl}
          alt={ad.title}
          className="w-full h-40 object-cover rounded-lg mb-3"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160"><rect width="300" height="160" fill="%23f3f4f6"/><text x="150" y="85" text-anchor="middle" fill="%236b7280" font-family="Arial" font-size="14">Advertisement</text></svg>`
          }}
        />

        <h3 className="font-semibold text-gray-900 mb-2">{ad.title}</h3>
        <p className="text-gray-600 text-sm mb-3">{ad.description}</p>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{ad.advertiser}</span>
          <button
            onClick={handleAdClick}
            className="bg-primary-600 text-white px-3 py-1 rounded text-sm hover:bg-primary-700 transition-colors"
          >
            {ad.cta}
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default Advertisement




