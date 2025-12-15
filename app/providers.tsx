'use client'

import dynamic from 'next/dynamic'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProductionChatProvider } from '@/contexts/ProductionChatContext'
import { Toaster } from 'react-hot-toast'

// Dynamically import ChatDock with SSR disabled to prevent hydration errors
const ChatDock = dynamic(() => import('@/features/chat/components/ChatDock'), {
  ssr: false,
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProductionChatProvider>
        {children}
        <ChatDock />
        <Toaster position="top-right" />
      </ProductionChatProvider>
    </AuthProvider>
  )
}

