'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { ProductionChatProvider } from '@/contexts/ProductionChatContext'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'
import { ThemedToaster } from '@/shared/components/theme/ThemedToaster'
import SignupEmailConfirmHandler from './components/SignupEmailConfirmHandler'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProductionChatProvider>
          <SignupEmailConfirmHandler />
          {children}
          <ThemedToaster />
        </ProductionChatProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

