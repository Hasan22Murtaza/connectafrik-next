import Link from 'next/link'
import { getNoIndexMetadata } from '@/lib/seo'

export const metadata = getNoIndexMetadata('Page not found')

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-content">Page not found</h1>
        <p className="mt-2 text-sm text-content-secondary">
          This page may have been removed, or the link may be incorrect.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex">
          Back to ConnectAfrik
        </Link>
      </div>
    </div>
  )
}
