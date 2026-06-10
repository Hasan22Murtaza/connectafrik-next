import { cancelOrder } from '@/features/marketplace/services/refundService'
import { AlertCircle, X, XCircle } from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

interface CancelOrderModalProps {
  orderId: string
  orderNumber: string
  productTitle: string
  totalAmount: number
  currency: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  orderId,
  orderNumber,
  productTitle,
  totalAmount,
  currency,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  if (!isOpen) return null

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const result = await cancelOrder(
        orderId,
        reason.trim() || 'Order cancelled by buyer'
      )

      if (result.success) {
        toast.success(result.message || 'Order cancelled successfully')
        onSuccess()
        onClose()
        setReason('')
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      toast.error('Failed to cancel order. Please try again.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleClose = () => {
    if (!isCancelling) {
      setReason('')
      onClose()
    }
  }

  const currencySymbol =
    currency === 'NGN' ? '₦' : currency === 'GHS' ? '₵' : currency === 'USD' ? '$' : currency

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-surface rounded-xl max-w-md w-full mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-semibold text-content">Cancel Order</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isCancelling}
            className="text-content-tertiary hover:text-content-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-surface-canvas rounded-lg p-4 mb-4 text-sm space-y-1">
            <p>
              <span className="text-content-secondary">Order #</span>{' '}
              <span className="font-medium">{orderNumber}</span>
            </p>
            <p>
              <span className="text-content-secondary">Product:</span>{' '}
              <span className="font-medium">{productTitle}</span>
            </p>
            <p>
              <span className="text-content-secondary">Amount:</span>{' '}
              <span className="font-medium">
                {currencySymbol}
                {totalAmount.toLocaleString()}
              </span>
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-800">
                This order has not shipped yet. Cancelling will issue a full refund to your
                original payment method. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-content mb-2">
              Reason for cancellation (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us why you're cancelling..."
              disabled={isCancelling}
              rows={3}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              disabled={isCancelling}
              className="flex-1 px-6 py-3 border border-border rounded-lg text-content font-medium hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              Keep Order
            </button>
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCancelling ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                'Cancel & Refund'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CancelOrderModal
