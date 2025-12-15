'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Home, Bookmark, ShoppingBag, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Product } from '@/shared/types'
import ProductCard from '@/features/marketplace/components/ProductCard'
import { PostCard } from '@/features/social/components/PostCard'
import Footer from '@/shared/components/layout/FooterNext'
import toast from 'react-hot-toast'

const SavedPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [savedProducts, setSavedProducts] = useState<Product[]>([])
  const [savedPosts, setSavedPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'posts'>('products')

  const fetchSavedItems = useCallback(async () => {
    try {
      setLoading(true)

      if (activeTab === 'products') {
        // Step 1: Fetch product saves with product IDs
        const { data: savesData, error: savesError } = await supabase
          .from('product_saves')
          .select('created_at, product_id')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })

        if (savesError) throw savesError

        if (!savesData || savesData.length === 0) {
          setSavedProducts([])
          return
        }

        // Step 2: Fetch products separately
        const productIds = savesData.map(save => save.product_id)
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds)

        if (productsError) throw productsError

        // Step 3: Fetch sellers for each product
        const productsWithSellers = await Promise.all(
          (productsData || []).map(async (product) => {
            const { data: seller } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url')
              .eq('id', product.seller_id)
              .single()

            return {
              ...product,
              seller,
              is_saved: true
            }
          })
        )

        setSavedProducts(productsWithSellers)
      } else {
        // Fetch saved posts (if you have a saved_posts table)
        // For now, showing empty state
        setSavedPosts([])
      }
    } catch (error: any) {
      console.error('Error fetching saved items:', error)
      toast.error('Failed to load saved items')
    } finally {
      setLoading(false)
    }
  }, [user, activeTab])

  useEffect(() => {
    if (user) {
      fetchSavedItems()
    }
  }, [user, fetchSavedItems])

  const handleUnsaveProduct = async (productId: string) => {
    try {
      await supabase
        .from('product_saves')
        .delete()
        .eq('product_id', productId)
        .eq('user_id', user?.id)

      toast.success('Product removed from saved items')
      fetchSavedItems()
    } catch (error: any) {
      console.error('Error unsaving product:', error)
      toast.error('Failed to remove product')
    }
  }

  const handleViewProduct = (productId: string) => {
    router.push(`/marketplace/${productId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 mt-16">
          {/* Back to Feed Button */}
          <button
            onClick={() => router.push('/feed')}
            className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <Home className="w-4 h-4" />
            <span className="font-medium">Back to Feed</span>
          </button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <Bookmark className="w-7 h-7 text-primary-600" />
                <span>Saved Items</span>
              </h1>
              <p className="text-gray-600 mt-1">
                View all your bookmarked products and posts
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'products'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Products ({savedProducts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('posts')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'posts'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Posts ({savedPosts.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : activeTab === 'products' ? (
          savedProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {savedProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSave={handleUnsaveProduct}
                  onView={handleViewProduct}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No saved products</h3>
              <p className="text-gray-500 mb-4">
                Browse the marketplace and save products you're interested in
              </p>
              <button
                onClick={() => router.push('/marketplace')}
                className="btn-primary"
              >
                Browse Marketplace
              </button>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No saved posts</h3>
            <p className="text-gray-500 mb-4">
              Save posts feature coming soon!
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default SavedPage

