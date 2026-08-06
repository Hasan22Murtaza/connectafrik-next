import React, { useState, useEffect } from 'react'
import { Star, ThumbsUp, MessageSquare } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'

interface Review {
  id: string
  user_id: string
  rating: number
  review_text: string
  helpful_count: number
  created_at: string
  user?: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
  is_helpful?: boolean
}

interface ProductReviewsProps {
  productId: string
  sellerId: string
  averageRating?: number
  reviewsCount?: number
  ratingBreakdown?: {
    rating_1_count: number
    rating_2_count: number
    rating_3_count: number
    rating_4_count: number
    rating_5_count: number
  }
}

const ProductReviews: React.FC<ProductReviewsProps> = ({
  productId,
  sellerId,
  averageRating = 0,
  reviewsCount = 0,
  ratingBreakdown
}) => {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [showWriteReview, setShowWriteReview] = useState(false)
  const [userReview, setUserReview] = useState<Review | null>(null)

  // Review form state
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [hoverRating, setHoverRating] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Prefer live review list over possibly stale product aggregate columns.
  const computedBreakdown = {
    rating_1_count: reviews.filter((r) => Number(r.rating) === 1).length,
    rating_2_count: reviews.filter((r) => Number(r.rating) === 2).length,
    rating_3_count: reviews.filter((r) => Number(r.rating) === 3).length,
    rating_4_count: reviews.filter((r) => Number(r.rating) === 4).length,
    rating_5_count: reviews.filter((r) => Number(r.rating) === 5).length,
  }
  const displayReviewsCount = reviews.length > 0 ? reviews.length : reviewsCount
  const displayAverageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length
      : averageRating
  const displayBreakdown =
    reviews.length > 0
      ? computedBreakdown
      : ratingBreakdown || {
          rating_1_count: 0,
          rating_2_count: 0,
          rating_3_count: 0,
          rating_4_count: 0,
          rating_5_count: 0,
        }

  useEffect(() => {
    if (productId) {
      fetchReviews()
    }
  }, [productId])

  const fetchReviews = async () => {
    try {
      setLoading(true)

      const allReviews: Review[] = []
      let page = 0
      let hasMore = true
      let currentUserReview: Review | null = null

      while (hasMore) {
        const res = await apiClient.get<{ data: Review[]; userReview: Review | null; hasMore?: boolean }>(
          `/api/marketplace/${productId}/reviews`,
          { page, limit: 20 }
        )

        const pageReviews = res.data || []
        allReviews.push(...pageReviews)
        if (!currentUserReview && res.userReview) {
          currentUserReview = res.userReview
        }

        hasMore = Boolean(res.hasMore)
        page += 1
        if (pageReviews.length === 0) break
      }

      setReviews(allReviews)
      setUserReview(currentUserReview)
    } catch (error: any) {
      console.error('Error fetching reviews:', error)
      toast.error('Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please sign in to write a review')
      return
    }

    // Prevent self-review
    if (user.id === sellerId) {
      toast.error('You cannot review your own product')
      return
    }

    setIsSubmitting(true)
    try {
      await apiClient.post(`/api/marketplace/${productId}/reviews`, {
        rating,
        review_text: reviewText.trim(),
        ...(userReview ? { reviewId: userReview.id } : {}),
      })

      toast.success(userReview ? 'Review updated successfully!' : 'Review posted successfully!')

      // Reset form and refresh reviews
      setShowWriteReview(false)
      setReviewText('')
      setRating(5)
      fetchReviews()
    } catch (error: any) {
      console.error('Error submitting review:', error)
      toast.error(error.message || 'Failed to submit review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleHelpful = async (reviewId: string, isCurrentlyHelpful: boolean) => {
    if (!user) {
      toast.error('Please sign in to mark reviews as helpful')
      return
    }

    try {
      const res = await apiClient.post<{ helpful: boolean }>(
        `/api/marketplace/${productId}/reviews/${reviewId}/helpful`
      )

      setReviews(prev => prev.map(review => {
        if (review.id === reviewId) {
          return {
            ...review,
            is_helpful: res.helpful,
            helpful_count: review.helpful_count + (res.helpful ? 1 : -1),
          }
        }
        return review
      }))

      toast.success(res.helpful ? 'Marked as helpful' : 'Removed helpful mark')
    } catch (error: any) {
      console.error('Error toggling helpful:', error)
      toast.error('Failed to update helpful status')
    }
  }

  const handleEditReview = () => {
    if (userReview) {
      setRating(userReview.rating)
      setReviewText(userReview.review_text)
      setShowWriteReview(true)
    }
  }

  const renderStars = (count: number, interactive: boolean = false, size: string = 'w-5 h-5') => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setRating(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
          >
            <Star
              className={`${size} ${
                star <= (interactive ? (hoverRating || rating) : count)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-content-tertiary'
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  const renderRatingBreakdown = () => {
    const total = displayReviewsCount || 0
    const ratings = [
      { stars: 5, count: displayBreakdown.rating_5_count },
      { stars: 4, count: displayBreakdown.rating_4_count },
      { stars: 3, count: displayBreakdown.rating_3_count },
      { stars: 2, count: displayBreakdown.rating_2_count },
      { stars: 1, count: displayBreakdown.rating_1_count }
    ]

    return (
      <div className="space-y-2">
        {ratings.map(({ stars, count }) => {
          const percentage = total > 0 ? (count / total) * 100 : 0
          return (
            <div key={stars} className="flex items-center gap-2">
              <span className="text-sm text-content-secondary w-8">{stars} ★</span>
              <div className="flex-1 bg-surface-tertiary rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-sm text-content-secondary w-8 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        {/* Left: Summary & Write Button */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <h2 className="text-lg font-bold text-content mb-4">Reviews</h2>
            <div className="flex flex-col items-start">
              <div className="text-4xl font-bold tracking-tight text-content mb-2">
                {displayAverageRating.toFixed(1)}
              </div>
              {renderStars(Math.round(displayAverageRating), false, 'w-6 h-6')}
              <p className="text-sm text-content-secondary mt-2">
                Based on {displayReviewsCount} {displayReviewsCount === 1 ? 'review' : 'reviews'}
              </p>
              <div className="mt-4 w-full">
                {renderRatingBreakdown()}
              </div>

              {user && user.id !== sellerId && !userReview && (
                <button
                  onClick={() => setShowWriteReview(!showWriteReview)}
                  className="mt-6 w-full btn-primary flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-5 h-5" />
                  Write a Review
                </button>
              )}

              {userReview && (
                <button
                  onClick={handleEditReview}
                  className="mt-3 w-full bg-surface-secondary hover:bg-surface-hover text-content font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  Edit Your Review
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Form & Reviews */}
        <div className="lg:col-span-2 space-y-0">
          {/* Write Review Form */}
          {showWriteReview && (
            <div className="pb-6 mb-2 border-b border-border">
              <h3 className="text-lg font-bold text-content mb-4">
                {userReview ? 'Edit Your Review' : 'Write a Review'}
              </h3>

              {/* Rating Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-content mb-2">
                  Your Rating
                </label>
                {renderStars(rating, true, 'w-8 h-8')}
              </div>

              {/* Review Text */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-content mb-2">
                  Your Review
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Share your experience with this product."
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmitting}
                  className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Posting...' : (userReview ? 'Update Review' : 'Post Review')}
                </button>
                <button
                  onClick={() => {
                    setShowWriteReview(false)
                    if (!userReview) {
                      setReviewText('')
                      setRating(5)
                    }
                  }}
                  className="px-6 py-3 bg-surface-tertiary text-content font-semibold rounded-xl hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div>
            {reviews.length === 0 ? (
              <div className="py-8 text-center border-t border-border-subtle lg:border-0">
                <MessageSquare className="w-10 h-10 text-content-tertiary mx-auto mb-3" />
                <h3 className="text-base font-semibold text-content mb-1">No reviews yet</h3>
                <p className="text-sm text-content-secondary">
                  Be the first to share your experience with this product.
                </p>
              </div>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="py-5 border-t border-border-subtle first:border-0 first:pt-0">
                  {/* Reviewer Info */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {review.user?.avatar_url ? (
                        <img
                          src={review.user.avatar_url}
                          alt={review.user.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-base font-bold text-primary-600">
                          {review.user?.full_name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-content text-sm">{review.user?.full_name}</h4>
                        <div className="flex items-center gap-2">
                          {renderStars(review.rating, false, 'w-3.5 h-3.5')}
                          <span className="text-xs text-content-secondary">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Review Text */}
                  <p className="text-[15px] text-content-secondary whitespace-pre-wrap wrap-break-word leading-relaxed">{review.review_text}</p>

                  {/* Helpful Button */}
                  <div className="mt-3 flex items-center gap-4">
                    <button
                      onClick={() => handleToggleHelpful(review.id, review.is_helpful || false)}
                      disabled={!user || review.user_id === user?.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        review.is_helpful
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-content-secondary hover:bg-surface-hover'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <ThumbsUp className={`w-4 h-4 ${review.is_helpful ? 'fill-current' : ''}`} />
                      Helpful ({review.helpful_count})
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductReviews
