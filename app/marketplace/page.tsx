'use client'

import React, { useState, useEffect } from 'react'
import { Search, Filter, Plus, ShoppingBag, ArrowLeft, Home, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Product } from '@/shared/types'
import ProductCard from '@/features/marketplace/components/ProductCard'
import CreateProductModal from '@/features/marketplace/components/CreateProductModal-v2'
import toast from 'react-hot-toast'

const MarketplacePage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)

  const categories = [
    { value: '', label: 'All Categories', emoji: '🛍️' },
    { value: 'fashion', label: 'Fashion', emoji: '👗' },
    { value: 'crafts', label: 'Crafts', emoji: '🎨' },
    { value: 'electronics', label: 'Electronics', emoji: '📱' },
    { value: 'food', label: 'Food & Beverages', emoji: '🍽️' },
    { value: 'beauty', label: 'Beauty & Care', emoji: '💄' },
    { value: 'home', label: 'Home & Living', emoji: '🏠' },
    { value: 'books', label: 'Books', emoji: '📚' },
    { value: 'art', label: 'Art', emoji: '🖼️' },
    { value: 'jewelry', label: 'Jewelry', emoji: '💎' },
    { value: 'services', label: 'Services', emoji: '🔧' },
    { value: 'other', label: 'Other', emoji: '📦' },
  ]

  const currencies = [
    { value: '', label: 'All Currencies' },
    { value: 'USD', label: 'USD ($)' },
    { value: 'GHS', label: 'GHS (₵)' },
    { value: 'NGN', label: 'NGN (₦)' },
    { value: 'KES', label: 'KES (KSh)' },
    { value: 'ZAR', label: 'ZAR (R)' },
    { value: 'XOF', label: 'XOF (CFA)' },
    { value: 'XAF', label: 'XAF (FCFA)' },
  ]

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, selectedCategory, selectedCurrency])

  const fetchProducts = async () => {
    try {
      setLoading(true)

      // Fetch products first
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .order('created_at', { ascending: false })

      if (productsError) throw productsError

      // Then fetch seller info separately for each product
      const productsWithSellers = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: seller } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .eq('id', product.seller_id)
            .single()

          return {
            ...product,
            seller
          }
        })
      )

      // If user is logged in, check if they saved each product
      if (user) {
        // Fetch user's saved products
        const { data: savedData } = await supabase
          .from('product_saves')
          .select('product_id')
          .eq('user_id', user.id)

        const savedProductIds = new Set(savedData?.map(s => s.product_id) || [])

        const productsWithSaveStatus = productsWithSellers.map(product => ({
          ...product,
          is_saved: savedProductIds.has(product.id)
        }))

        setProducts(productsWithSaveStatus)
      } else {
        setProducts(productsWithSellers)
      }
    } catch (error: any) {
      console.error('Error fetching products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const filterProducts = () => {
    let filtered = products

    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase()
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(lowercaseSearch) ||
        product.description.toLowerCase().includes(lowercaseSearch) ||
        product.tags.some(tag => tag.toLowerCase().includes(lowercaseSearch)) ||
        product.location?.toLowerCase().includes(lowercaseSearch)
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter(product => product.category === selectedCategory)
    }

    if (selectedCurrency) {
      filtered = filtered.filter(product => product.currency === selectedCurrency)
    }

    setFilteredProducts(filtered)
  }

  const handleSaveProduct = async (productId: string) => {
    if (!user) {
      toast.error('Please sign in to save products')
      return
    }

    try {
      const product = products.find(p => p.id === productId)
      if (!product) return

      if (product.is_saved) {
        // Unsave
        await supabase
          .from('product_saves')
          .delete()
          .eq('product_id', productId)
          .eq('user_id', user.id)

        toast.success('Product removed from saved items')
      } else {
        // Save
        await supabase
          .from('product_saves')
          .insert({
            product_id: productId,
            user_id: user.id
          })

        toast.success('Product saved!')
      }

      // Update local state
      setProducts(products.map(p =>
        p.id === productId ? { ...p, is_saved: !p.is_saved } : p
      ))
    } catch (error: any) {
      console.error('Error saving product:', error)
      toast.error('Failed to save product')
    }
  }

  const handleViewProduct = async (productId: string) => {
    router.push(`/marketplace/${productId}`)
  }

  const featuredProducts = products.filter(p => p.is_featured).slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 mt-16">
          {/* Back to Feed Button */}
          <Link
            href="/feed"
            className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <Home className="w-4 h-4" />
            <span className="font-medium">Back to Feed</span>
          </Link>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <ShoppingBag className="w-7 h-7 text-primary-600" />
                <span>African Marketplace</span>
              </h1>
              <p className="text-gray-600 mt-1">
                Discover authentic products from African entrepreneurs and businesses
              </p>
            </div>

            {user && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Sell Product</span>
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search products by name, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white min-w-[180px]"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.emoji} {category.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Filter */}
            <div className="relative">
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white min-w-[140px]"
              >
                {currencies.map(currency => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Featured Products */}
        {!searchTerm && !selectedCategory && featuredProducts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900">Featured Products</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSave={handleSaveProduct}
                  onView={handleViewProduct}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Products */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {searchTerm || selectedCategory ? 'Search Results' : 'All Products'}
              {filteredProducts.length > 0 && (
                <span className="text-gray-500 font-normal ml-2">
                  ({filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''})
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSave={user ? handleSaveProduct : undefined}
                  onView={handleViewProduct}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || selectedCategory || selectedCurrency
                  ? 'Try adjusting your search filters or browse all products.'
                  : 'Be the first to list a product in the marketplace!'}
              </p>
              {user && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                >
                  List Your First Product
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Create Product Modal */}
      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => fetchProducts()}
      />
    </div>
  )
}

export default MarketplacePage

