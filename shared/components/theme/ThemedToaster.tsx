'use client'

import { Toaster } from 'react-hot-toast'
import { useTheme } from '@/shared/theme/useTheme'

export function ThemedToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: resolvedTheme === 'dark' ? '#242526' : '#ffffff',
          color: resolvedTheme === 'dark' ? '#e4e6eb' : '#050505',
          border: resolvedTheme === 'dark' ? '1px solid #3e4042' : '1px solid #e4e6eb',
        },
      }}
    />
  )
}
