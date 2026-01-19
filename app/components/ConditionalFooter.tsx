'use client'

import { usePathname } from 'next/navigation'
import Footer from '@/shared/components/layout/FooterNext'

export default function ConditionalFooter() {
  const pathname = usePathname()
  
  // Hide footer on these pages
  const hideFooterPaths = [
    "/signin",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/call",
  ];
  
  if (hideFooterPaths.includes(pathname)) {
    return null
  }
  
  return <Footer />
}
