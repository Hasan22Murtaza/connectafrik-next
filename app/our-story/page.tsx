'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, Globe, Users, Target, Star, Lightbulb } from '@/shared/icons'

const journeyItems = [
  {
    year: 'The Awakening (2023)',
    color: 'bg-emerald-500',
    border: 'border-emerald-500',
    description:
      'We saw how fragmented online communities had become and began researching what people everywhere need from a modern social platform: connection, belonging, and room to share real stories.',
  },
  {
    year: 'The Foundation (Early 2024)',
    color: 'bg-blue-500',
    border: 'border-blue-500',
    description:
      'We brought together a diverse team of developers, creators, journalists, and community builders from around the world to design CribsTalk from the ground up.',
  },
  {
    year: 'The Launch (Mid 2024)',
    color: 'bg-green-500',
    border: 'border-green-500',
    description:
      'CribsTalk launched with a powerful set of core features: conversation spaces, cultural storytelling, groups, messaging, and tools for community collaboration.',
  },
  {
    year: 'The Growth (Late 2024-Present)',
    color: 'bg-purple-500',
    border: 'border-purple-500',
    description:
      'The platform continues to expand with enhanced features, mobile accessibility, creator tools, marketplace commerce, and innovations built for a global audience.',
  },
]

const values = [
  {
    title: 'Belonging',
    accent: 'text-emerald-600 dark:text-emerald-400',
    description:
      'We believe everyone deserves a place to connect, be heard, and feel at home—wherever they are in the world.',
  },
  {
    title: 'Authenticity',
    accent: 'text-blue-600 dark:text-blue-400',
    description:
      'We celebrate real stories, real identities, and real experiences—without dilution.',
  },
  {
    title: 'Diversity',
    accent: 'text-green-600 dark:text-green-400',
    description:
      'Our strength is our diversity. We amplify voices from every culture, language, and community worldwide.',
  },
  {
    title: 'Innovation',
    accent: 'text-purple-600 dark:text-purple-400',
    description:
      'We build technology for people everywhere and push boundaries to redefine what a social platform can be.',
  },
  {
    title: 'Respect',
    accent: 'text-rose-600 dark:text-rose-400',
    description:
      'We nurture a safe and respectful environment where debate, culture, and expression can flourish.',
  },
  {
    title: 'Empowerment',
    accent: 'text-amber-600 dark:text-amber-400',
    description:
      'We provide tools for individuals, creators, and communities to grow, earn, collaborate, and impact the world.',
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
                CribsTalk Journey
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                Our Story
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                From vision to reality — building a global social home for
                connecting, communicating, and community worldwide.
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
                The Beginning
              </h2>
            </div>
            <div className="space-y-4 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
              <p className="text-lg leading-8">
                CribsTalk was born from a simple truth: people everywhere hold
                rich cultures, ideas, and stories — yet those voices are often
                scattered across platforms, stripped of context, or lost in the
                noise. We wanted a place that feels like a social home for the
                world.
              </p>
              <p>
                In 2024, technologists, creators, and community leaders came
                together around one mission: build a global platform for
                connecting, communicating, sharing, and building communities —
                open to everyone, everywhere. A digital space where dialogue
                thrives, culture is celebrated, and people can belong without
                borders.
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
                To help people connect, communicate, and build communities
                worldwide — amplifying diverse voices, enabling meaningful
                dialogue, celebrating culture, and creating a global ecosystem
                where every story matters and every voice is heard.
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
                A world where people from every background shape global
                conversations, where cultures are celebrated and protected, and
                where communities stay deeply connected while building a better
                future together.
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
                  Active Members
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
                <div className="mb-1 text-3xl font-bold text-blue-600 dark:text-blue-400">
                  100+
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                  Countries Represented
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
              CribsTalk is built by a passionate team of technologists,
              creators, and community leaders from around the world.
            </p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
              <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full">
                  <Image
                    src="/assets/images/team/senyo.jpeg"
                    alt="Senyo Komla Tsedze"
                    width={96}
                    height={96}
                    className="h-full w-full rounded-full object-cover object-center"
                  />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Senyo Komla Tsedze
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Founder &amp; CEO
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
                <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full">
                  <Image
                    src="/assets/images/team/eli.jpeg"
                    alt="Eli Orlando Adetor"
                    width={96}
                    height={96}
                    className="h-full w-full rounded-full object-cover object-center"
                  />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Eli Orlando Adetor
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  President
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-slate-800">
                <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full">
                  <Image
                    src="/assets/images/team/hasan.jfif"
                    alt="Hasan Murtaza"
                    width={96}
                    height={96}
                    className="h-full w-full rounded-full object-cover object-center"
                  />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Hasan Murtaza
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  CTO &amp; Developer
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Join Our Story
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-[15px] leading-7 text-slate-700 dark:text-slate-300">
              CribsTalk&apos;s story is just beginning, and we want you to be
              part of it. Together, we can connect people worldwide and build
              bridges that span continents.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700"
              >
                Join CribsTalk
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
