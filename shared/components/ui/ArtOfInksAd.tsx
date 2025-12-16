import React, { useState } from 'react'
import { Phone, MapPin, Palette, Printer, Star, Sparkles, Award, Users, Clock, CheckCircle } from 'lucide-react'

interface ArtOfInksAdProps {
  type?: 'banner' | 'card' | 'featured'
  className?: string
}

const ArtOfInksAd: React.FC<ArtOfInksAdProps> = ({ type = 'card', className = '' }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [rippleEffect, setRippleEffect] = useState({ x: 0, y: 0, show: false })
  const [showFeatures, setShowFeatures] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setRippleEffect({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      show: true
    })
    setTimeout(() => setRippleEffect(prev => ({ ...prev, show: false })), 600)
    action()
  }

  const handleCallNow = () => {
    window.location.href = 'tel:+233541418930'
  }

  const handleGetDirections = () => {
    const address = 'HO, GOIL DOWN STADIUM ROAD, VOLTA REGION, GHANA'
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/${encodedAddress}`, '_blank', 'noopener,noreferrer')
  }

  if (type === 'banner') {
    return (
      <div className={`bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white py-4 px-6 relative overflow-hidden ${className}`}>
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-lg animate-bounce"></div>
        </div>
        
        <div className="max-w-6xl mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center shadow-lg animate-pulse">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <span>ART OF INKS</span>
                <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
              </h3>
              <p className="text-sm opacity-90">Premium Graphic Design & Large Format Printing</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm opacity-75 flex items-center space-x-1">
              <MapPin className="w-4 h-4" />
              <span>Ho, Volta Region</span>
            </span>
            <button
              onClick={handleCallNow}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              Call Now
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'featured') {
    return (
      <div 
        className={`relative bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 border-2 border-transparent rounded-xl p-6 overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${className}`}
        style={{
          background: 'linear-gradient(135deg, #faf5ff, #f3e8ff, #fdf4ff)',
          boxShadow: isHovered 
            ? '0 25px 50px -12px rgba(147, 51, 234, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 10px 25px -5px rgba(147, 51, 234, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          borderImage: 'linear-gradient(45deg, #e879f9, #a855f7, #c084fc) 1'
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Animated background elements */}
        {isHovered && (
          <div 
            className="absolute pointer-events-none transition-opacity duration-300"
            style={{
              left: mousePosition.x - 100,
              top: mousePosition.y - 100,
              width: 200,
              height: 200,
              background: 'radial-gradient(circle, rgba(147, 51, 234, 0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(20px)'
            }}
          />
        )}
        
        {/* Floating elements */}
        <div className="absolute top-4 right-4 opacity-20">
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-bounce"></div>
        </div>
        <div className="absolute bottom-4 left-4 opacity-20">
          <div className="w-6 h-6 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full animate-pulse"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm border border-white/20 animate-pulse">
              <Palette className="w-6 h-6 text-white drop-shadow-sm" />
            </div>
            <div>
              <h3 className="font-bold text-xl bg-gradient-to-r from-violet-800 via-purple-800 to-fuchsia-800 bg-clip-text text-transparent drop-shadow-sm flex items-center space-x-2">
                <span>ART OF INKS</span>
                <Sparkles className="w-4 h-4 text-yellow-500 animate-spin" />
              </h3>
              <div className="flex items-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-current drop-shadow-sm" />
                ))}
                <span className="text-sm bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent ml-2">Premium Service</span>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden">
            <span className="bg-gradient-to-r from-violet-100 to-purple-100 border-2 border-violet-200 text-violet-800 px-4 py-2 rounded-full text-sm font-medium shadow-inner whitespace-nowrap backdrop-blur-sm">
              Sponsored
            </span>
          </div>
        </div>

        <div className="relative z-10 mb-6">
          <h4 className="font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2 drop-shadow-sm">Transform Your Vision Into Stunning Visuals</h4>
          <p className="text-gray-600 text-sm leading-relaxed">
            Professional graphic design services and large format printing in the Volta Region. 
            From business branding to event banners, we bring your creative ideas to life with 
            exceptional quality and attention to detail.
          </p>
        </div>

        {/* Interactive Features Section */}
        <div className="relative z-10 mb-6">
          <button
            onClick={() => setShowFeatures(!showFeatures)}
            className="w-full text-left mb-3 text-sm font-medium text-violet-700 hover:text-violet-800 transition-colors"
          >
            {showFeatures ? 'Hide' : 'Show'} Our Services →
          </button>
          
          {showFeatures && (
            <div className="grid grid-cols-2 gap-4 mb-4 animate-fadeIn">
              <div className="flex items-center space-x-2 group">
                <Printer className="w-4 h-4 text-violet-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-gray-700 group-hover:text-violet-600 transition-colors">Large Format Printing</span>
              </div>
              <div className="flex items-center space-x-2 group">
                <Palette className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-gray-700 group-hover:text-purple-600 transition-colors">Custom Graphic Design</span>
              </div>
              <div className="flex items-center space-x-2 group">
                <Award className="w-4 h-4 text-yellow-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-gray-700 group-hover:text-yellow-600 transition-colors">Premium Quality</span>
              </div>
              <div className="flex items-center space-x-2 group">
                <Users className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm text-gray-700 group-hover:text-green-600 transition-colors">Expert Team</span>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 bg-gradient-to-br from-white to-gray-50 rounded-lg p-4 mb-4 border border-gray-100 shadow-inner">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Visit Our Location</span>
          </div>
          <p className="text-sm text-gray-600">HO, GOIL DOWN STADIUM ROAD</p>
          <p className="text-sm text-gray-600">Volta Region, Ghana</p>
        </div>

        <div className="relative z-10 flex space-x-3">
          <button
            onClick={(e) => handleButtonClick(e, handleCallNow)}
            className="relative flex-1 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white px-4 py-3 rounded-lg font-medium hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl overflow-hidden flex items-center justify-center space-x-2"
          >
            {rippleEffect.show && (
              <span 
                className="absolute bg-white/30 rounded-full animate-ping"
                style={{
                  left: rippleEffect.x - 10,
                  top: rippleEffect.y - 10,
                  width: 20,
                  height: 20
                }}
              />
            )}
            <Phone className="relative z-10 w-4 h-4" />
            <span className="relative z-10">Call Now</span>
          </button>
          <button
            onClick={(e) => handleButtonClick(e, handleGetDirections)}
            className="relative flex-1 bg-gradient-to-r from-white to-gray-50 border-2 border-violet-200 text-violet-600 px-4 py-3 rounded-lg font-medium hover:border-violet-300 hover:bg-violet-50 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg overflow-hidden flex items-center justify-center space-x-2"
          >
            {rippleEffect.show && (
              <span 
                className="absolute bg-violet-500/20 rounded-full animate-ping"
                style={{
                  left: rippleEffect.x - 10,
                  top: rippleEffect.y - 10,
                  width: 20,
                  height: 20
                }}
              />
            )}
            <MapPin className="relative z-10 w-4 h-4" />
            <span className="relative z-10">Directions</span>
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Contact: <span className="font-medium">+233 54 141 8930</span>
          </p>
        </div>
      </div>
    )
  }

  // Default card type with enhanced effects
  return (
    <div 
      className={`relative bg-gradient-to-br from-white via-violet-50 to-white border-2 border-transparent rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 ${className}`}
      style={{
        background: 'linear-gradient(145deg, #ffffff, #faf5ff, #f8fafc)',
        boxShadow: isHovered 
          ? '0 25px 50px -12px rgba(147, 51, 234, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          : '0 10px 25px -5px rgba(147, 51, 234, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Spotlight effect */}
      {isHovered && (
        <div 
          className="absolute pointer-events-none transition-opacity duration-300"
          style={{
            left: mousePosition.x - 100,
            top: mousePosition.y - 100,
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(20px)'
          }}
        />
      )}
      
      {/* Enhanced header with embossed gradient frame */}
      <div className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-4 py-3 overflow-hidden">
        {/* Embossed background effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400/30 via-orange-300/20 to-orange-500/40" />
        <div className="absolute inset-0 bg-gradient-to-tl from-green-300/40 via-green-200/30 to-green-400/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/20 animate-pulse shadow-lg" style={{
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Palette className="w-4 h-4 text-white drop-shadow-sm" />
            </div>
            <div>
              <h3 className="font-bold text-white drop-shadow-sm bg-gradient-to-r from-white to-orange-100 bg-clip-text text-transparent flex items-center space-x-1" style={{
                textShadow: '0 1px 2px rgba(0,0,0,0.3), 0 -1px 1px rgba(255,255,255,0.3)'
              }}>
                <span>ART OF INKS</span>
                <Sparkles className="w-3 h-3 text-orange-300 animate-spin" />
              </h3>
              <p className="text-xs text-white/90 drop-shadow-sm" style={{
                textShadow: '0 1px 1px rgba(0,0,0,0.2)'
              }}>Graphic Design Studio</p>
            </div>
          </div>
          <div className="relative overflow-hidden">
            <span className="bg-gradient-to-r from-white/25 to-white/15 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-white/20 whitespace-nowrap shadow-inner" style={{
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1), 0 1px 2px rgba(255,255,255,0.2)'
            }}>
              Sponsored
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced content with embossed background */}
      <div className="relative p-4 bg-gradient-to-b from-white to-violet-50/50">
        {/* Embossed background layer */}
        <div className="absolute inset-2 bg-gradient-to-br from-orange-50/30 via-white to-green-50/40 rounded-lg" style={{
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05), inset 0 -2px 4px rgba(255,255,255,0.8)'
        }} />
        
        <div className="relative z-10">
          <h4 className="font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2 text-sm drop-shadow-sm" style={{
            textShadow: '0 1px 2px rgba(0,0,0,0.1), 0 -1px 1px rgba(255,255,255,0.3)'
          }}>
            Premium Design & Large Format Printing
          </h4>
          <p className="text-gray-600 text-xs mb-4 leading-relaxed" style={{
            textShadow: '0 1px 1px rgba(255,255,255,0.5)'
          }}>
            Transform your brand with professional graphic design and high-quality large format printing. 
            Serving businesses across the Volta Region with creative excellence.
          </p>

          {/* Enhanced services with embossed effect */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="flex items-center space-x-1 group">
              <span className="w-2 h-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full shadow-sm group-hover:scale-110 transition-transform" style={{
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2), 0 1px 2px rgba(255,255,255,0.3)'
              }}></span>
              <span className="text-xs text-gray-700 group-hover:text-orange-600 transition-colors" style={{
                textShadow: '0 1px 1px rgba(255,255,255,0.5)'
              }}>Logo Design</span>
            </div>
            <div className="flex items-center space-x-1 group">
              <span className="w-2 h-2 bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-sm group-hover:scale-110 transition-transform" style={{
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2), 0 1px 2px rgba(255,255,255,0.3)'
              }}></span>
              <span className="text-xs text-gray-700 group-hover:text-green-600 transition-colors" style={{
                textShadow: '0 1px 1px rgba(255,255,255,0.5)'
              }}>Banners</span>
            </div>
            <div className="flex items-center space-x-1 group">
              <span className="w-2 h-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full shadow-sm group-hover:scale-110 transition-transform" style={{
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2), 0 1px 2px rgba(255,255,255,0.3)'
              }}></span>
              <span className="text-xs text-gray-700 group-hover:text-orange-600 transition-colors" style={{
                textShadow: '0 1px 1px rgba(255,255,255,0.5)'
              }}>Brochures</span>
            </div>
            <div className="flex items-center space-x-1 group">
              <span className="w-2 h-2 bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-sm group-hover:scale-110 transition-transform" style={{
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2), 0 1px 2px rgba(255,255,255,0.3)'
              }}></span>
              <span className="text-xs text-gray-700 group-hover:text-green-600 transition-colors" style={{
                textShadow: '0 1px 1px rgba(255,255,255,0.5)'
              }}>Signage</span>
            </div>
          </div>

          {/* Enhanced location with embossed effect */}
          <div className="bg-gradient-to-br from-orange-50/50 to-green-50/50 rounded-lg p-3 mb-4 border border-orange-100/50 shadow-inner" style={{
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05), inset 0 -2px 4px rgba(255,255,255,0.8)'
          }}>
            <div className="flex items-center space-x-2 mb-1">
              <MapPin className="w-3 h-3 text-orange-500" style={{
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))'
              }} />
              <span className="text-xs font-medium bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent" style={{
                textShadow: '0 1px 1px rgba(255,255,255,0.5)'
              }}>Our Location</span>
            </div>
            <p className="text-xs text-gray-600" style={{
              textShadow: '0 1px 1px rgba(255,255,255,0.5)'
            }}>HO, GOIL DOWN STADIUM ROAD</p>
            <p className="text-xs text-gray-600" style={{
              textShadow: '0 1px 1px rgba(255,255,255,0.5)'
            }}>Volta Region, Ghana</p>
          </div>

          {/* Interactive buttons with embossed effects */}
          <div className="flex space-x-2">
            <button
              onClick={(e) => handleButtonClick(e, handleCallNow)}
              className="relative flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:from-orange-600 hover:to-orange-700 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl overflow-hidden"
              style={{
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1)'
              }}
            >
              {rippleEffect.show && (
                <span 
                  className="absolute bg-white/30 rounded-full animate-ping"
                  style={{
                    left: rippleEffect.x - 10,
                    top: rippleEffect.y - 10,
                    width: 20,
                    height: 20
                  }}
                />
              )}
              <span className="relative z-10">📞 Call Now</span>
            </button>
            <button
              onClick={(e) => handleButtonClick(e, handleGetDirections)}
              className="relative px-3 py-2 bg-gradient-to-r from-white to-green-50 border-2 border-green-200 text-green-600 rounded-lg text-xs hover:border-green-300 hover:text-green-700 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg overflow-hidden"
              style={{
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {rippleEffect.show && (
                <span 
                  className="absolute bg-green-500/20 rounded-full animate-ping"
                  style={{
                    left: rippleEffect.x - 10,
                    top: rippleEffect.y - 10,
                    width: 20,
                    height: 20
                  }}
                />
              )}
              <span className="relative z-10">📍 Map</span>
            </button>
          </div>

          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500" style={{
              textShadow: '0 1px 1px rgba(255,255,255,0.5)'
            }}>
              <span className="font-medium bg-gradient-to-r from-gray-700 to-gray-500 bg-clip-text text-transparent">+233 54 141 8930</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ArtOfInksAd