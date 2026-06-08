import {
  addDisputeEvidence,
  DISPUTE_REASONS,
  DisputeReason,
  openDispute,
} from '@/features/marketplace/services/disputeService'
import { AlertTriangle, Shield, X } from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

interface OpenDisputeModalProps {
  orderId: string
  orderNumber: string
  productTitle: string
  isOpen: boolean
  onClose: () => void
  onSuccess: (disputeId: string) => void
}

const OpenDisputeModal: React.FC<OpenDisputeModalProps> = ({
  orderId,
  orderNumber,
  productTitle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState<DisputeReason>('not_as_described')
  const [description, setDescription] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Please describe the issue')
      return
    }

    setIsSubmitting(true)
    try {
      const dispute = await openDispute({
        order_id: orderId,
        reason,
        description: description.trim(),
        requested_resolution: 'full_refund',
      })

      if (evidenceUrl.trim()) {
        try {
          await addDisputeEvidence(dispute.id, {
            evidence_type: 'photo',
            file_url: evidenceUrl.trim(),
            description: 'Initial evidence',
          })
        } catch {
          /* non-blocking */
        }
      }

      toast.success('Dispute opened. Seller payout is on hold.')
      onSuccess(dispute.id)
      onClose()
      setDescription('')
      setEvidenceUrl('')
    } catch (error: unknown) {
      console.error(error)
      toast.error('Failed to open dispute')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="bg-white rounded-xl max-w-lg w-full mx-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-600" />
            <h2 className="text-xl font-semibold text-gray-900">Open Dispute</h2>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p><span className="text-gray-500">Order #</span> <span className="font-medium">{orderNumber}</span></p>
            <p className="mt-1"><span className="text-gray-500">Product:</span> <span className="font-medium">{productTitle}</span></p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-800">
              Opening a dispute will freeze the seller&apos;s payout while we review your case.
              The seller has 3 days to respond.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Issue type</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DisputeReason)}
              disabled={isSubmitting}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              {DISPUTE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Describe the problem *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={isSubmitting}
              placeholder="Explain what went wrong and what resolution you expect..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidence URL (optional)
            </label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              disabled={isSubmitting}
              placeholder="Link to photo or document"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Dispute'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OpenDisputeModal
