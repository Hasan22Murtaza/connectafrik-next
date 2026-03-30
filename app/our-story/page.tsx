'use client'

import Link from 'next/link'
import { Heart, Globe, Users, Target, Star, Lightbulb } from 'lucide-react'

const journeyItems = [
  {
    year: 'The Awakening (2023)',
    color: 'bg-emerald-500',
    border: 'border-emerald-500',
    description:
      'Recognizing the fragmentation of African voices across global platforms, we began research into what African communities truly needed from a digital platform.',
  },
  {
    year: 'The Foundation (Early 2024)',
    color: 'bg-blue-500',
    border: 'border-blue-500',
    description:
      'We assembled a diverse team of developers, cultural experts, and community leaders from across Africa and the diaspora to build the foundation of what would become ConnectAfrik.',
  },
  {
    year: 'The Launch (Mid 2024)',
    color: 'bg-green-500',
    border: 'border-green-500',
    description:
      'After months of development and community testing, ConnectAfrik launched with its core features: political discussions, cultural sharing, and community building tools.',
  },
  {
    year: 'The Growth (Late 2024)',
    color: 'bg-purple-500',
    border: 'border-purple-500',
    description:
      'Today, ConnectAfrik continues to evolve, adding new features and expanding our community while staying true to our core mission of celebrating and connecting African voices.',
  },
]

const values = [
  {
    title: 'Ubuntu',
    accent: 'text-emerald-600 dark:text-emerald-400',
    description:
      '"I am because we are" - We believe in the interconnectedness of all African people and the power of collective success.',
  },
  {
    title: 'Authenticity',
    accent: 'text-blue-600 dark:text-blue-400',
    description:
      'We celebrate genuine African experiences, stories, and perspectives without dilution or appropriation.',
  },
  {
    title: 'Diversity',
    accent: 'text-green-600 dark:text-green-400',
    description:
      "Africa's strength lies in its diversity. We embrace and amplify voices from all 54 countries and every corner of the diaspora.",
  },
  {
    title: 'Innovation',
    accent: 'text-purple-600 dark:text-purple-400',
    description:
      'We continuously evolve our platform to better serve our community while pioneering new ways to connect and engage.',
  },
  {
    title: 'Respect',
    accent: 'text-rose-600 dark:text-rose-400',
    description:
      'Every voice matters. We maintain a respectful environment where constructive dialogue can flourish.',
  },
  {
    title: 'Empowerment',
    accent: 'text-amber-600 dark:text-amber-400',
    description:
      'We provide tools and opportunities for African individuals and communities to grow, connect, and succeed.',
  },
]

const OurStory = () => {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8 dark:from-slate-950 dark:to-slate-950 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Heart className="h-3.5 w-3.5" />
                ConnectAfrik Journey
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                Our Story
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                From vision to reality: building the premier platform for African
                voices worldwide.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                Started
              </p>
              <p>2024</p>
            </div>
          </div>
        </header>

        <section className="space-y-6">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <Heart className="h-7 w-7 text-rose-500" />
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                The Genesis
              </h2>
            </div>
            <div className="space-y-4 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
              <p className="text-lg leading-8">
                ConnectAfrik was born from a simple yet powerful realization:
                despite being home to over 1.4 billion people across 54 nations,
                Africa&apos;s diverse voices were scattered across different
                platforms, often losing their unique context and power in the
                global digital noise.
              </p>
              <p>
                In 2024, a group of African technologists, diaspora leaders, and
                cultural advocates came together with a shared vision to create a
                digital home where African political discourse could flourish,
                cultural heritage could be preserved and celebrated, and
                meaningful connections could bridge the gap between the continent
                and its global diaspora.
              </p>
            </div>
          </article>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <Target className="h-7 w-7 text-blue-500" />
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Our Mission
                </h2>
              </div>
              <p className="text-[15px] leading-7 text-slate-700 dark:text-slate-300">
                To amplify African voices, foster meaningful political dialogue,
                preserve cultural heritage, and build bridges that connect
                Africans across continents creating a digital ecosystem where
                every African story matters and every voice is heard.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                <Lightbulb className="h-7 w-7 text-amber-500" />
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Our Vision
                </h2>
              </div>
              <p className="text-[15px] leading-7 text-slate-700 dark:text-slate-300">
                A world where African perspectives shape global conversations,
                where cultural diversity is celebrated, and where the African
                diaspora remains deeply connected to their roots while building
                bridges to their future.
              </p>
            </article>
          </div>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <Globe className="h-7 w-7 text-emerald-500" />
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Our Journey
              </h2>
            </div>
            <div className="space-y-8">
              {journeyItems.map(item => (
                <div
                  key={item.year}
                  className={`border-l-4 pl-6 ${item.border} dark:border-opacity-80`}
                >
                  <div className="mb-2 flex items-center">
                    <div
                      className={`mr-3 h-3 w-3 rounded-full ${item.color}`}
                    />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {item.year}
                    </h3>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <Star className="h-7 w-7 text-amber-500" />
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Our Values
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {values.map(value => (
                <div
                  key={value.title}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <h3 className={`mb-2 text-lg font-semibold ${value.accent}`}>
                    {value.title}
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <Users className="h-7 w-7 text-blue-500" />
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Our Impact
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
                <div className="mb-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  10,000+
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                  Active Community Members
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
                <div className="mb-1 text-3xl font-bold text-blue-600 dark:text-blue-400">
                  54
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                  African Countries Represented
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
                <div className="mb-1 text-3xl font-bold text-green-600 dark:text-green-400">
                  500+
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                  Cultural Stories Shared
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <h2 className="mb-4 text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Meet Our Team
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-center text-[15px] leading-7 text-slate-700 dark:text-slate-300">
              ConnectAfrik is built by a passionate team of African
              technologists, cultural advocates, and community leaders from
              across the continent and diaspora.
            </p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
                <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 text-xl font-bold text-white">
                  ST
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Senyo Komla Tsedze
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Founder &amp; CEO
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
                <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-blue-500 text-xl font-bold text-white">
                  CT
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Community Team
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Pan-African Collective
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
                <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-xl font-bold text-white">
                  DT
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Development Team
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Global African Diaspora
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Join Our Story
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-[15px] leading-7 text-slate-700 dark:text-slate-300">
              ConnectAfrik&apos;s story is just beginning, and we want you to be
              part of it. Together, we can amplify African voices and build
              bridges that span continents.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700"
              >
                Join ConnectAfrik
              </Link>
              <Link
                href="/support"
                className="inline-flex rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
              >
                Contact Us
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  )
}

export default OurStory

