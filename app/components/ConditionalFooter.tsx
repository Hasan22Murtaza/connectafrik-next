'use client'

import { usePathname } from 'next/navigation'
import Footer from '@/shared/components/layout/FooterNext'

export default function ConditionalFooter() {
  const pathname = usePathname()
  
  // Hide footer on these auth pages and call pages
  const hideFooterPaths = [
    "/signin",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ];
  
  // Hide footer on call pages
  if (pathname?.startsWith('/call/')) {
    return null
  }
  
  if (hideFooterPaths.includes(pathname)) {
    return null
  }
  
  return <Footer />
}
