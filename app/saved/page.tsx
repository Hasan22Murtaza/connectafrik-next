'use client'

import { useAuth } from '@/contexts/AuthContext'
import ProductCard from '@/features/marketplace/components/ProductCard'
import { apiClient } from '@/lib/api-client'
import Footer from '@/shared/components/layout/FooterNext'
import { Product } from '@/shared/types'
import { Bookmark, FileText, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
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
        const allProducts: Product[] = []
        let page = 0
        let hasMore = true

        while (hasMore) {
          const res = await apiClient.get<{ data: Product[]; hasMore?: boolean }>(
            '/api/marketplace/saved',
            { page, limit: 20 }
          )
          const pageProducts = res.data || []
          allProducts.push(...pageProducts)
          hasMore = Boolean(res.hasMore)
          page += 1

          if (pageProducts.length === 0) break
        }

        setSavedProducts(allProducts)
      } else {
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
      await apiClient.post(`/api/marketplace/${productId}/save`)
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
      <div className='max-w-full 2xl:max-w-screen-2xl mx-auto px-4'>
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="  py-6 ">
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
          <div className="flex items-center space-x-2">
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
      <div className=" py-8">
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
</div>      
    </div>
  )
}

export default SavedPage

