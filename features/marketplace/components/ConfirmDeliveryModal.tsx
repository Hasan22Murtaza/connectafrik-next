import React, { useState } from 'react'
import { X, Package, CheckCircle, AlertCircle } from 'lucide-react'
import { confirmDelivery } from '@/features/marketplace/services/commissionService'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface ConfirmDeliveryModalProps {
  orderId: string
  orderNumber: string
  productTitle: string
  sellerName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const ConfirmDeliveryModal: React.FC<ConfirmDeliveryModalProps> = ({
  orderId,
  orderNumber,
  productTitle,
  sellerName,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth()
  const [trackingNumber, setTrackingNumber] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  if (!isOpen || !user) return null

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      const result = await confirmDelivery(
        orderId,
        user.id,
        trackingNumber || undefined
      )

      if (result.success) {
        setConfirmed(true)
        toast.success('Delivery confirmed! Seller will receive payment.')
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      }
    } catch (error) {
      console.error('Error confirming delivery:', error)
      toast.error('Failed to confirm delivery. Please try again.')
    } finally {
      setIsConfirming(false)
    }
  }

  const handleClose = () => {
    if (!isConfirming) {
      setConfirmed(false)
      setTrackingNumber('')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Confirm Delivery</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isConfirming}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!confirmed ? (
            <>
              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Order #</span>
                    <span className="ml-2 font-medium text-gray-900">{orderNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Product:</span>
                    <span className="ml-2 font-medium text-gray-900">{productTitle}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Seller:</span>
                    <span className="ml-2 font-medium text-gray-900">{sellerName}</span>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      Important: Only confirm if you received your order
                    </p>
                    <p className="text-xs text-yellow-700">
                      Confirming delivery will release payment to the seller. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tracking Number (Optional) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking Number (Optional)
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number if available"
                  disabled={isConfirming}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Confirmation Checklist */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium text-blue-900 mb-2">Before confirming:</p>
                <ul className="space-y-1 text-xs text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">✓</span>
                    <span>I have physically received the product</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">✓</span>
                    <span>The product matches the description and is in good condition</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5">✓</span>
                    <span>I am satisfied with this order</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleClose}
                  disabled={isConfirming}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isConfirming ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>Confirm Delivery</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Delivery Confirmed!
              </h3>
              <p className="text-gray-600 mb-1">
                Payment is being processed and will be released to the seller.
              </p>
              <p className="text-sm text-gray-500">
                Thank you for shopping on ConnectAfrik!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConfirmDeliveryModal
