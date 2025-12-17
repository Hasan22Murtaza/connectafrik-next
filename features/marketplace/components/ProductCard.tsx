import React, { useState } from 'react'
import { MapPin, Bookmark, Eye, Tag, Package, ShoppingCart, MessageCircle, Share2 } from 'lucide-react'
import { Product } from '@/shared/types'
import { formatDistanceToNow } from 'date-fns'
import SmartCheckout from './SmartCheckout'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { ChatParticipant } from '@/features/chat/services/supabaseMessagingService'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

interface ProductCardProps {
  product: Product
  onSave?: (productId: string) => void
  onView: (productId: string) => void
  onPurchaseSuccess?: () => void
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onSave, onView, onPurchaseSuccess }) => {
  const [showCheckout, setShowCheckout] = useState(false)
  const [isContactingseller, setIsContactingeller] = useState(false)
  const { user } = useAuth()
  const { startChatWithMembers } = useProductionChat()

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      GHS: '₵',
      NGN: '₦',
      KES: 'KSh',
      ZAR: 'R',
      XOF: 'CFA',
      XAF: 'FCFA'
    }
    return symbols[currency] || currency
  }

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      fashion: '👗',
      crafts: '🎨',
      electronics: '📱',
      food: '🍽️',
      beauty: '💄',
      home: '🏠',
      books: '📚',
      art: '🖼️',
      jewelry: '💎',
      services: '🔧',
      other: '📦'
    }
    return emojis[category] || '📦'
  }

  const getConditionColor = (condition: string) => {
    const colors: Record<string, string> = {
      'new': 'bg-green-100 text-green-700',
      'like-new': 'bg-blue-100 text-blue-700',
      'good': 'bg-yellow-100 text-yellow-700',
      'fair': 'bg-orange-100 text-orange-700'
    }
    return colors[condition] || 'bg-gray-100 text-gray-700'
  }

  const handleContactSeller = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!user) {
      toast.error('Please sign in to contact the seller')
      return
    }

    if (!product.seller?.id) {
      toast.error('Seller information not available')
      return
    }

    if (user.id === product.seller.id) {
      toast.error('This is your own product')
      return
    }

    setIsContactingeller(true)
    try {
      const sellerParticipant: ChatParticipant = {
        id: product.seller.id,
        name: product.seller.full_name,
        avatarUrl: product.seller.avatar_url
      }

      await startChatWithMembers([sellerParticipant], {
        participant_ids: [product.seller.id],
        openInDock: true
      })
      toast.success(`Chat opened with ${product.seller.full_name}`)
    } catch (error) {
      console.error('Error opening chat:', error)
      toast.error('Failed to open chat with seller')
    } finally {
      setIsContactingeller(false)
    }
  }

  const handleShareProduct = async (e: React.MouseEvent) => {
    e.stopPropagation()

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_UR}/marketplace/product/${product.id}`
    const shareText = `Check out this product: ${product.title} - ${getCurrencySymbol(product.currency)}${product.price.toLocaleString()}`

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: shareText,
          url: shareUrl
        })
        toast.success('Product shared!')
      } catch (error) {
        // User cancelled or share failed
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error)
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Product link copied to clipboard!')
      } catch (error) {
        console.error('Error copying to clipboard:', error)
        toast.error('Failed to copy link')
      }
    }
  }

  const mainImage = product.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'
  const isOutOfStock = product.stock_quantity === 0
  const isUnavailable = !product.is_available
  const isOwnProduct = user?.id === product.seller?.id

  return (
    <div
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer group focus-within:ring-2 focus-within:ring-primary-500"
      onClick={() => onView(product.id)}
      role="article"
      aria-label={`${product.title} - ${getCurrencySymbol(product.currency)}${product.price.toLocaleString()}`}
    >
      {/* Product Image */}
      <div className="relative h-48 overflow-hidden bg-gray-100">
        <img
          src={mainImage}
          alt={product.title}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Featured Badge */}
        {product.is_featured && (
          <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
            <span>⭐</span>
            <span>Featured</span>
          </div>
        )}

        {/* Save Button */}
        {onSave && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSave(product.id)
            }}
            className={`absolute top-2 right-2 p-2 rounded-full transition-colors ${
              product.is_saved
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${product.is_saved ? 'fill-current' : ''}`} />
          </button>
        )}

        {/* Condition Badge */}
        <div className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-medium ${getConditionColor(product.condition)}`}>
          {product.condition === 'like-new' ? 'Like New' : product.condition.charAt(0).toUpperCase() + product.condition.slice(1)}
        </div>

        {/* Stock Status */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold">SOLD OUT</span>
          </div>
        )}

        {/* Unavailable Status */}
        {!isOutOfStock && isUnavailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-gray-600 text-white px-4 py-2 rounded-lg font-bold">UNAVAILABLE</span>
          </div>
        )}

        {/* Share Button */}
        <button
          onClick={handleShareProduct}
          className="absolute top-2 left-2 p-2 rounded-full bg-white text-gray-600 hover:bg-gray-100 transition-colors shadow-md"
          aria-label="Share product"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Product Details */}
      <div className="p-4">
        {/* Category */}
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-lg">{getCategoryEmoji(product.category)}</span>
          <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
            {product.category}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {product.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {product.description}
        </p>

        {/* Price */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-2xl font-bold text-primary-600">
              {getCurrencySymbol(product.currency)}{product.price.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500 ml-1">{product.currency}</span>
          </div>
          {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
            <div className="flex items-center space-x-1 text-xs text-orange-600">
              <Package className="w-3 h-3" />
              <span>Only {product.stock_quantity} left</span>
            </div>
          )}
        </div>

        {/* Location & Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          {product.location && (
            <div className="flex items-center space-x-1">
              <MapPin className="w-3 h-3" />
              <span>{product.location}, {product.country}</span>
            </div>
          )}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <Eye className="w-3 h-3" />
              <span>{product.views_count}</span>
            </div>
            {product.saves_count > 0 && (
              <div className="flex items-center space-x-1">
                <Bookmark className="w-3 h-3" />
                <span>{product.saves_count}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {product.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
              >
                <Tag className="w-3 h-3" />
                <span>{tag}</span>
              </span>
            ))}
            {product.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                +{product.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Seller Info */}
        {product.seller && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              {product.seller.avatar_url ? (
                <img
                  src={product.seller.avatar_url}
                  alt={product.seller.full_name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-600">
                    {product.seller.full_name.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-xs text-gray-600">{product.seller.full_name}</span>
            </div>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(product.created_at), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          {/* Contact Seller Button - Only show if not own product */}
          {!isOwnProduct && product.seller && (
            <button
              onClick={handleContactSeller}
              disabled={isContactingseller}
              className="flex-1 py-2 px-3 rounded-lg font-medium flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
              aria-label="Contact seller"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isContactingseller ? 'Opening...' : 'Contact'}
              </span>
            </button>
          )}

          {/* Buy Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (isOwnProduct) {
                toast.error('This is your own product')
                return
              }
              if (isOutOfStock || isUnavailable) return
              setShowCheckout(true)
            }}
            disabled={isOutOfStock || isUnavailable || isOwnProduct}
            className={`py-2 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
              isOwnProduct ? 'flex-1' : 'flex-[2]'
            } ${
              isOutOfStock || isUnavailable || isOwnProduct
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
            aria-label={isOutOfStock ? 'Out of stock' : isUnavailable ? 'Unavailable' : isOwnProduct ? 'Your product' : 'Buy now'}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>
              {isOwnProduct
                ? 'Your Product'
                : isOutOfStock
                ? 'Out of Stock'
                : isUnavailable
                ? 'Unavailable'
                : 'Buy Now'}
            </span>
          </button>
        </div>
      </div>

      {/* Checkout Modal - Auto-selects Paystack or Stripe based on currency */}
      <SmartCheckout
        product={product}
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={() => {
          setShowCheckout(false)
          onPurchaseSuccess?.()
        }}
      />
    </div>
  )
}

export default ProductCard
