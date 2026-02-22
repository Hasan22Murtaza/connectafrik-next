import React, { useState, useEffect } from 'react'
import { Star, ThumbsUp, MessageSquare, AlertCircle } from 'lucide-react'
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

  const MIN_REVIEW_LENGTH = 150
  const characterCount = reviewText.length
  const isValid = characterCount >= MIN_REVIEW_LENGTH

  useEffect(() => {
    if (productId) {
      fetchReviews()
    }
  }, [productId])

  const fetchReviews = async () => {
    try {
      setLoading(true)

      const res = await apiClient.get<{ data: Review[]; userReview: Review | null }>(
        `/api/marketplace/${productId}/reviews`
      )

      setReviews(res.data || [])
      setUserReview(res.userReview || null)
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

    if (!isValid) {
      toast.error(`Review must be at least ${MIN_REVIEW_LENGTH} characters`)
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
        review_text: reviewText,
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
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  const renderRatingBreakdown = () => {
    if (!ratingBreakdown) return null

    const total = reviewsCount || 0
    const ratings = [
      { stars: 5, count: ratingBreakdown.rating_5_count },
      { stars: 4, count: ratingBreakdown.rating_4_count },
      { stars: 3, count: ratingBreakdown.rating_3_count },
      { stars: 2, count: ratingBreakdown.rating_2_count },
      { stars: 1, count: ratingBreakdown.rating_1_count }
    ]

    return (
      <div className="space-y-2">
        {ratings.map(({ stars, count }) => {
          const percentage = total > 0 ? (count / total) * 100 : 0
          return (
            <div key={stars} className="flex items-center gap-2">
              <span className="text-sm text-gray-600 w-8">{stars} ★</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-sm text-gray-600 w-8 text-right">{count}</span>
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
    <div className="mt-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Summary & Write Button */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 lg:sticky lg:top-28">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Customer Reviews</h2>
            <div className="flex flex-col items-start">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {averageRating.toFixed(1)}
              </div>
              {renderStars(Math.round(averageRating), false, 'w-6 h-6')}
              <p className="text-sm text-gray-600 mt-2">
                Based on {reviewsCount} {reviewsCount === 1 ? 'review' : 'reviews'}
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
                  className="mt-3 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
                >
                  Edit Your Review
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Form & Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* Write Review Form */}
          {showWriteReview && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {userReview ? 'Edit Your Review' : 'Write a Review'}
              </h3>

              {/* Rating Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Rating
                </label>
                {renderStars(rating, true, 'w-8 h-8')}
              </div>

              {/* Review Text */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Review (minimum {MIN_REVIEW_LENGTH} characters)
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={6}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    reviewText.length > 0 && !isValid
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="Share your experience with this product. What did you like? What could be improved? (At least 150 characters)"
                />
                <div className="flex justify-between items-center mt-2">
                  <div className={`text-sm ${
                    !isValid && characterCount > 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {characterCount} / {MIN_REVIEW_LENGTH} characters
                    {!isValid && characterCount > 0 && (
                      <span className="ml-2">
                        ({MIN_REVIEW_LENGTH - characterCount} more needed)
                      </span>
                    )}
                  </div>
                  {isValid && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Ready to post!
                    </span>
                  )}
                </div>
              </div>

              {/* Engagement Reminder */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Detailed reviews help other shoppers make informed decisions! Share specifics about quality, shipping, and your overall experience.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmitting || !isValid}
                  className="flex-1 btn-primary  disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No reviews yet</h3>
                <p className="text-gray-600">
                  Be the first to share your experience with this product!
                </p>
              </div>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="bg-white rounded-lg shadow p-6">
                  {/* Reviewer Info */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {review.user?.avatar_url ? (
                        <img
                          src={review.user.avatar_url}
                          alt={review.user.full_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-lg font-bold text-primary-600">
                          {review.user?.full_name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-gray-900">{review.user?.full_name}</h4>
                        <div className="flex items-center gap-2">
                          {renderStars(review.rating, false, 'w-4 h-4')}
                          <span className="text-sm text-gray-500">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Review Text */}
                  <p className="text-gray-700 whitespace-pre-wrap wrap-break-word">{review.review_text}</p>

                  {/* Helpful Button */}
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      onClick={() => handleToggleHelpful(review.id, review.is_helpful || false)}
                      disabled={!user || review.user_id === user?.id}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        review.is_helpful
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
