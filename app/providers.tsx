'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { ChatLockProvider } from '@/contexts/ChatLockContext'
import { ProductionChatProvider } from '@/contexts/ProductionChatContext'
import { E2eeBootstrap } from '@/features/chat/components/E2eeBootstrap'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'
import { ThemedToaster } from '@/shared/components/theme/ThemedToaster'
import SignupEmailConfirmHandler from './components/SignupEmailConfirmHandler'
import DeepLinkHandler from './components/DeepLinkHandler'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatLockProvider>
        <ProductionChatProvider>
          <E2eeBootstrap />
          <SignupEmailConfirmHandler />
          <DeepLinkHandler />
          {children}
          <ThemedToaster />
        </ProductionChatProvider>
        </ChatLockProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

