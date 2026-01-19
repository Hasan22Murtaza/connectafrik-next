'use client'

import { usePathname } from 'next/navigation'
import Header from '@/shared/components/layout/HeaderNext'

export default function ConditionalHeader() {
  const pathname = usePathname()
  
  // Hide header on these auth pages and call page
  const hideHeaderPaths = [
    "/signin",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/call",
  ];
  
  if (hideHeaderPaths.includes(pathname)) {
    return null
  }
  
  return <Header />
}

