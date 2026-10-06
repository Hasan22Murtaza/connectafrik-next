import Link from 'next/link'
import { getNoIndexMetadata } from '@/lib/seo'
import { AuthIllustration } from '@/shared/components/auth/AuthIllustration'

export const metadata = getNoIndexMetadata()

const PAGE_BG = '#FBF6EF'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1500px] grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <AuthIllustration />

        <section className="flex min-h-screen min-w-0 w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-5 lg:h-screen lg:overflow-y-auto lg:px-5 lg:py-8">
          <div className="w-full max-w-[420px]">
            <div className="mb-6 flex justify-center lg:hidden">
              <Link href="/" aria-label="CribsTalk home">
                <img
                  src="/assets/images/logo_2.png"
                  alt="CribsTalk"
                  className="h-10 w-auto object-contain"
                  draggable={false}
                />
              </Link>
            </div>
            {children}
          </div>
        </section>
      </div>
    </div>
  )
}
