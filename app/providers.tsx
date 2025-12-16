'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { ProductionChatProvider } from '@/contexts/ProductionChatContext'
import { Toaster } from 'react-hot-toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProductionChatProvider>
        {children}
        <Toaster position="top-right" />
      </ProductionChatProvider>
    </AuthProvider>
  )
}

