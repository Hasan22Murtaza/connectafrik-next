'use client'

import React from 'react'
import Link from 'next/link'
import { User, Users, Loader2, ShoppingBag } from 'lucide-react'
import type { SearchResults } from '@/shared/services/searchService'
import { formatCount } from '@/shared/utils/formatUtils'

interface SearchResultsDropdownProps {
  results: SearchResults | null
  isSearching: boolean
  searchTerm: string
  onClose: () => void
}

/**
 * Search result item component for users
 */
const UserResultItem: React.FC<{
  user: SearchResults['users'][0]
  onClose: () => void
}> = ({ user, onClose }) => (
  <Link
    href={`/user/${user.username}`}
    onClick={onClose}
    className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
  >
    <div className="flex-shrink-0 mr-3">
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.full_name}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
          <User className="w-5 h-5 text-gray-400" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-gray-900 truncate">{user.full_name}</div>
      <div className="text-sm text-gray-500 truncate">
        People
        {user.follower_count !== null && user.follower_count > 0 && (
          <> · {formatCount(user.follower_count)} followers</>
        )}
      </div>
    </div>
  </Link>
)

/**
 * Search result item component for posts
 */
const PostResultItem: React.FC<{
  post: SearchResults['posts'][0]
  onClose: () => void
}> = ({ post, onClose }) => (
  <Link
    href={`/post/${post.id}`}
    onClick={onClose}
    className="flex items-start px-4 py-3 hover:bg-gray-50 transition-colors"
  >
    <div className="flex-shrink-0 mr-3">
      {post.author.avatar_url ? (
        <img
          src={post.author.avatar_url}
          alt={post.author.full_name}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
          <User className="w-5 h-5 text-gray-400" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-gray-900 truncate">
        {post.title || post.content.substring(0, 50)}
      </div>
      <div className="text-sm text-gray-500 truncate">
        {post.author.full_name} · {post.category}
      </div>
    </div>
  </Link>
)

/**
 * Search result item component for groups
 */
const GroupResultItem: React.FC<{
  group: SearchResults['groups'][0]
  onClose: () => void
}> = ({ group, onClose }) => (
  <Link
    href={`/groups/${group.id}`}
    onClick={onClose}
    className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
  >
    <div className="flex-shrink-0 mr-3">
      {group.avatar_url ? (
        <img
          src={group.avatar_url}
          alt={group.name}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
          <Users className="w-5 h-5 text-gray-400" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-gray-900 truncate">{group.name}</div>
      <div className="text-sm text-gray-500 truncate">
        Group · {formatCount(group.member_count)} members
      </div>
    </div>
  </Link>
)

/**
 * Search result item component for products
 */
const ProductResultItem: React.FC<{
  product: SearchResults['products'][0]
  onClose: () => void
}> = ({ product, onClose }) => {
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(price)
  }

  return (
    <Link
      href={`/marketplace/${product.id}`}
      onClick={onClose}
      className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="flex-shrink-0 mr-3">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.title}
            className="w-10 h-10 rounded-lg object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 truncate">{product.title}</div>
        <div className="text-sm text-gray-500 truncate">
          {formatPrice(product.price, product.currency)} · {product.category}
        </div>
      </div>
    </Link>
  )
}

/**
 * Section header component
 */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{title}</div>
)

/**
 * Empty state component
 */
const EmptyState: React.FC = () => (
  <div className="px-4 py-8 text-center text-gray-500">No results found</div>
)

/**
 * Loading state component
 */
const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
  </div>
)

/**
 * SearchResultsDropdown Component
 * 
 * Displays search results in a Facebook-like dropdown interface
 * Organized by entity type (Users, Posts, Groups)
 */
const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = ({
  results,
  isSearching,
  searchTerm,
  onClose,
}) => {
  // Don't render if search term is too short
  if (searchTerm.trim().length < 2) {
    return null
  }

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[600px] overflow-y-auto z-50 md:block">
      {isSearching ? (
        <LoadingState />
      ) : results ? (
        <div className="py-2">
          {/* Users Section */}
          {results.users.length > 0 && (
            <div className="mb-2">
              <SectionHeader title="People" />
              {results.users.map((user) => (
                <UserResultItem key={user.id} user={user} onClose={onClose} />
              ))}
            </div>
          )}

          {/* Posts Section */}
          {results.posts.length > 0 && (
            <div className="mb-2">
              <SectionHeader title="Posts" />
              {results.posts.map((post) => (
                <PostResultItem key={post.id} post={post} onClose={onClose} />
              ))}
            </div>
          )}

          {/* Groups Section */}
          {results.groups.length > 0 && (
            <div className="mb-2">
              <SectionHeader title="Groups" />
              {results.groups.map((group) => (
                <GroupResultItem key={group.id} group={group} onClose={onClose} />
              ))}
            </div>
          )}

          {/* Products Section */}
          {results.products.length > 0 && (
            <div className="mb-2">
              <SectionHeader title="Products" />
              {results.products.map((product) => (
                <ProductResultItem key={product.id} product={product} onClose={onClose} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {results.users.length === 0 &&
            results.posts.length === 0 &&
            results.groups.length === 0 &&
            results.products.length === 0 && <EmptyState />}
        </div>
      ) : null}
    </div>
  )
}

export default SearchResultsDropdown

