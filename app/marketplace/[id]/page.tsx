'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ShoppingBag, Heart, Share2, MapPin, Phone, MessageCircle, Truck, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { supabase } from '@/lib/supabase'
import { Product } from '@/shared/types'
import toast from 'react-hot-toast'
import ProductReviews from '@/features/marketplace/components/ProductReviews'

const ProductDetailPage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { user } = useAuth()
  const { startChatWithMembers, openThread } = useProductionChat()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)

  useEffect(() => {
    if (id) {
      fetchProduct()
      checkIfSaved()
      updateViewCount()
    }
  }, [id, user])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      console.log('Fetching product with ID:', id)

      // Step 1: Fetch product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()

      if (productError) {
        console.error('Product query error:', productError)
        throw productError
      }

      console.log('Product fetched:', productData)

      // Step 2: Fetch seller profile separately
      if (productData.seller_id) {
        const { data: sellerData, error: sellerError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, bio')
          .eq('id', productData.seller_id)
          .single()

        if (!sellerError && sellerData) {
          // Combine product and seller data
          productData.seller = sellerData
          console.log('Seller data added:', sellerData)
        } else {
          console.warn('Could not fetch seller data:', sellerError)
        }
      }

      console.log('Product loaded successfully:', productData)
      setProduct(productData)
      if (productData.images && productData.images.length > 0) {
        setSelectedImage(0)
      }
    } catch (error: any) {
      console.error('Error fetching product:', error)
      toast.error(`Failed to load product: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const checkIfSaved = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('product_saves')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', id)
        .maybeSingle()

      if (error) {
        console.error('Error checking saved status:', error)
        return
      }

      if (data) setIsSaved(true)
    } catch (error) {
      console.error('Caught error checking saved status:', error)
    }
  }

  const updateViewCount = async () => {
    try {
      await supabase.rpc('increment_product_views', { product_id: id })
    } catch (error) {
      console.error('Error updating view count:', error)
    }
  }

  const handleSave = async () => {
    if (!user) {
      toast.error('Please sign in to save products')
      return
    }

    try {
      if (isSaved) {
        await supabase
          .from('product_saves')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', id)

        setIsSaved(false)
        toast.success('Removed from saved items')
      } else {
        await supabase
          .from('product_saves')
          .insert({ user_id: user.id, product_id: id })

        setIsSaved(true)
        toast.success('Added to saved items')
      }
    } catch (error) {
      toast.error('Failed to update saved status')
    }
  }

  const handleShare = () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    if (navigator.share) {
      navigator.share({
        title: product?.title,
        text: product?.description,
        url: url,
      })
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard')
    }
  }

  const handleContactSeller = async () => {
    if (!user) {
      toast.error('Please sign in to contact seller')
      return
    }

    if (!product?.seller?.id) {
      toast.error('Seller information not available')
      return
    }

    try {
      const loadingToast = toast.loading('Starting chat with seller...')

      // Create chat participant for seller
      const sellerParticipant = {
        id: product.seller.id,
        name: product.seller.full_name,
        avatarUrl: product.seller.avatar_url || undefined
      }

      // Start chat with seller
      const threadId = await startChatWithMembers([sellerParticipant], { 
        participant_ids: [product.seller_id], 
        openInDock: true 
      })

      toast.dismiss(loadingToast)

      if (threadId) {
        openThread(threadId)
        toast.success(`Chat started with ${product.seller.full_name}`)
      } else {
        toast.error('Failed to start chat')
      }
    } catch (error) {
      console.error('Error starting chat:', error)
      toast.error('Failed to start chat')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <ShoppingBag className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Product not found</h2>
        <button
          onClick={() => router.push('/marketplace')}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Back to Marketplace
        </button>
      </div>
    )
  }

  const images = product.images || []
  const hasMultipleImages = images.length > 1

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push('/marketplace')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Marketplace
            </button>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleShare}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleSave}
                className={`p-2 rounded-full ${
                  isSaved
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details */}
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
              <img
                src={images[selectedImage] || 'https://via.placeholder.com/600x600?text=No+Image'}
                alt={product.title}
                className="w-full h-96 object-cover"
              />
            </div>
            {hasMultipleImages && (
              <div className="grid grid-cols-4 gap-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`border-2 rounded-lg overflow-hidden ${
                      selectedImage === index ? 'border-primary-600' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.title} ${index + 1}`}
                      className="w-full h-20 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {product.location || 'Location not specified'}
                </span>
                <span>•</span>
                <span>{product.views_count || 0} views</span>
              </div>
            </div>

            <div className="text-4xl font-bold text-primary-600">
              {product.currency} {product.price.toLocaleString()}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Product Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Category:</span>
                  <span className="ml-2 text-gray-900 capitalize">{product.category}</span>
                </div>
                <div>
                  <span className="text-gray-600">Condition:</span>
                  <span className="ml-2 text-gray-900 capitalize">{product.condition}</span>
                </div>
                <div>
                  <span className="text-gray-600">Stock:</span>
                  <span className="ml-2 text-gray-900">{product.stock_quantity > 0 ? `${product.stock_quantity} available` : 'Out of stock'}</span>
                </div>
                {product.shipping_available && (
                  <div className="flex items-center text-green-600">
                    <Truck className="w-4 h-4 mr-1" />
                    <span>Shipping available</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{product.description}</p>
            </div>

            {/* Seller Info */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Seller Information</h3>
              <div className="flex items-start space-x-3">
                <img
                  src={product.seller?.avatar_url || `https://ui-avatars.com/api/?name=${product.seller?.full_name || 'User'}&background=random`}
                  alt={product.seller?.full_name || 'Seller'}
                  className="w-12 h-12 rounded-full"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{product.seller?.full_name || 'Unknown'}</h4>
                  <p className="text-sm text-gray-600">@{product.seller?.username || 'unknown'}</p>
                </div>
              </div>
              {product.seller?.bio && (
                <p className="text-sm text-gray-600 mt-3">{product.seller.bio}</p>
              )}
            </div>

            {/* Contact Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleContactSeller}
                className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center font-medium"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Contact Seller
              </button>
              {product.contact_phone && (
                <a
                  href={`tel:${product.contact_phone}`}
                  className="w-full bg-white border-2 border-primary-600 text-primary-600 py-3 px-6 rounded-lg hover:bg-primary-50 transition-colors flex items-center justify-center font-medium"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Call Seller
                </a>
              )}
            </div>

            {/* Trust & Safety */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <h4 className="font-semibold text-blue-900 mb-1">Stay Safe</h4>
                  <ul className="text-blue-700 space-y-1">
                    <li>• Meet in a safe, public location</li>
                    <li>• Inspect items before purchasing</li>
                    <li>• Don't send money in advance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Reviews Section */}
        <div className="mt-12">
          <ProductReviews
            productId={product.id}
            sellerId={product.seller_id}
            averageRating={product.average_rating || 0}
            reviewsCount={product.reviews_count || 0}
            ratingBreakdown={{
              rating_1_count: product.rating_1_count || 0,
              rating_2_count: product.rating_2_count || 0,
              rating_3_count: product.rating_3_count || 0,
              rating_4_count: product.rating_4_count || 0,
              rating_5_count: product.rating_5_count || 0
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default ProductDetailPage

