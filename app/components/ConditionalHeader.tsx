'use client'

import { usePathname } from 'next/navigation'
import Header from '@/shared/components/layout/HeaderNext'

export default function ConditionalHeader() {
  const pathname = usePathname()
  
  // Hide header on these auth pages and call pages
  const hideHeaderPaths = [
    "/signin",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ];
  
  // Hide header on call pages (like Facebook)
  if (pathname?.startsWith('/call/')) {
    return null
  }
  
  if (hideHeaderPaths.includes(pathname)) {
    return null
  }
  
  return <Header />
}

