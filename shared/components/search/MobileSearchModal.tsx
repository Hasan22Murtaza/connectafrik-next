'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, X, User, Users, ShoppingBag, Loader2 } from 'lucide-react'
import { useSearch } from '@/shared/hooks/useSearch'
import type { SearchResults } from '@/shared/services/searchService'
import { formatCount } from '@/shared/utils/formatUtils'

interface MobileSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

const formatPrice = (price: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(price)
}

const MobileSearchModal: React.FC<MobileSearchModalProps> = ({ isOpen, onClose }) => {
  const {
    searchTerm,
    searchResults,
    isSearching,
    handleSearch,
    clearSearch,
  } = useSearch()

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleInputChange = (value: string) => {
    handleSearch(value)
  }

  const handleClose = () => {
    clearSearch()
    onClose()
  }

  if (!isOpen) return null

  const hasResults = searchResults && (
    searchResults.users.length > 0 ||
    searchResults.posts.length > 0 ||
    searchResults.groups.length > 0 ||
    searchResults.products.length > 0
  )

  return (
    <div className="fixed inset-0 z-50 bg-white md:hidden">
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close search"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search ConnectAfrik..."
              className="w-full pl-10 pr-10 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:bg-white"
              value={searchTerm}
              onChange={(e) => handleInputChange(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => {
                  handleInputChange('')
                  inputRef.current?.focus()
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
            </div>
          ) : searchTerm.trim().length >= 2 && hasResults ? (
            <div className="py-2">
              {searchResults.users.length > 0 && (
                <div className="mb-4">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    People
                  </div>
                  {searchResults.users.map((user) => (
                    <Link
                      key={user.id}
                      href={`/user/${user.username}`}
                      onClick={handleClose}
                      className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 mr-3">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500">
                          People
                          {user.follower_count !== null && user.follower_count > 0 && (
                            <> · {formatCount(user.follower_count)} followers</>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {searchResults.posts.length > 0 && (
                <div className="mb-4">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Posts
                  </div>
                  {searchResults.posts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/post/${post.id}`}
                      onClick={handleClose}
                      className="flex items-start px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 mr-3">
                        {post.author.avatar_url ? (
                          <img
                            src={post.author.avatar_url}
                            alt={post.author.full_name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">
                          {post.title || post.content.substring(0, 50)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {post.author.full_name} · {post.category}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {searchResults.groups.length > 0 && (
                <div className="mb-4">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Groups
                  </div>
                  {searchResults.groups.map((group) => (
                    <Link
                      key={group.id}
                      href={`/groups/${group.id}`}
                      onClick={handleClose}
                      className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 mr-3">
                        {group.avatar_url ? (
                          <img
                            src={group.avatar_url}
                            alt={group.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <Users className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{group.name}</div>
                        <div className="text-sm text-gray-500">
                          Group · {formatCount(group.member_count)} members
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {searchResults.products.length > 0 && (
                <div className="mb-4">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Products
                  </div>
                  {searchResults.products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/marketplace/${product.id}`}
                      onClick={handleClose}
                      className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 mr-3">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.title}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{product.title}</div>
                        <div className="text-sm text-gray-500">
                          {formatPrice(product.price, product.currency)} · {product.category}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {!hasResults && (
                <div className="px-4 py-12 text-center text-gray-500">
                  No results found
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="text-center">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">
                  Search ConnectAfrik
                </p>
                <p className="text-gray-400 text-sm">
                  Find people, posts, groups, and products
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MobileSearchModal

