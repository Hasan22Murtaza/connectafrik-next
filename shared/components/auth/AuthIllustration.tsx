import Link from 'next/link'
import { Caveat } from 'next/font/google'

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['600', '700'],
})

export function AuthIllustration() {
  return (
    <section className="relative hidden min-w-0 lg:flex lg:h-screen lg:items-center lg:overflow-hidden lg:pl-4 xl:pl-8">
      <Link
        href="/"
        className="absolute left-4 top-6 z-20 inline-flex xl:left-6"
        aria-label="CribsTalk home"
      >
        <img
          src="/assets/images/logo_2.png"
          alt="CribsTalk"
          className="h-12 w-auto object-contain"
          draggable={false}
        />
      </Link>
      <div className="relative mx-auto h-full w-full max-w-[760px]">
        <img
          src="/assets/images/signin-promo-illustration.png"
          alt="People connecting around a shared cultural home on CribsTalk"
          className="h-full w-full object-contain object-center select-none"
          draggable={false}
        />
        <div
          className={`pointer-events-none absolute inset-0 hidden ${caveat.className} xl:block`}
          aria-hidden="true"
        >
          <p className="absolute left-[32%] top-[11%] -rotate-[8deg] text-[1.35rem] font-bold leading-tight text-[#3F2A14]">
            Our Crib, Our Culture,
            <br />
            Our Roots.
          </p>
          <p className="absolute right-[6%] top-[36%] max-w-[7.5rem] text-right text-[1.35rem] font-bold leading-snug text-[#1A1A1A]">
            Connect
            <br />
            Share
            <br />
            Belong
          </p>
          <div className="absolute bottom-[16%] left-[4%] max-w-[230px] rounded-[28px] rounded-br-md bg-[#16A34A] px-5 py-3 text-white shadow-md">
            <p className="text-[1.15rem] font-bold leading-tight">
              Our environment, Our Story
              <br />
              Our talk, Our Platform.
            </p>
          </div>
          <p className="absolute bottom-[10%] left-[10%] text-base italic text-[#1A1A1A]">
            Strength in Our talk
          </p>
          <div className="absolute bottom-[22%] right-[3%] max-w-[140px] rotate-[8deg] rounded-[40%_60%_50%_50%] bg-[#F97316] px-4 py-3 text-center text-[13px] font-semibold leading-snug text-white">
            Our welcoming platform to the world
          </div>
        </div>
      </div>
    </section>
  )
}
