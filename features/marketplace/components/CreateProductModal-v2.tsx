'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CREATE_LISTING_PATH } from '@/features/marketplace/constants/marketplaceConstants'

interface CreateProductModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

/** @deprecated Use /marketplace/selling/create page instead. Redirects when opened. */
const CreateProductModal: React.FC<CreateProductModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      onClose()
      router.push(CREATE_LISTING_PATH)
    }
  }, [isOpen, onClose, router])

  return null
}

export default CreateProductModal
