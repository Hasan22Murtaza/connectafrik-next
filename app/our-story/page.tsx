'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, Globe, Users, Target, Star, Lightbulb, ArrowRight, ShieldCheck, Sparkles } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'

const journeyItems = [
  {
    year: '2023',
    title: 'The Awakening',
    tagColor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    description:
      'We saw how fragmented online communities had become and began researching what people everywhere need from a modern social platform: connection, belonging, and room to share real stories.',
  },
  {
    year: 'Early 2024',
    title: 'The Foundation',
    tagColor: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    description:
      'We brought together a diverse team of developers, creators, journalists, and community builders from around the world to design CribsTalk from the ground up.',
  },
  {
    year: 'Mid 2024',
    title: 'The Launch',
    tagColor: 'text-green-600 bg-green-50 dark:bg-green-950/60 dark:text-green-400 border-green-200 dark:border-green-800',
    description:
      'CribsTalk launched with a powerful set of core features: conversation spaces, cultural storytelling, groups, messaging, and tools for community collaboration.',
  },
  {
    year: 'Late 2024-Present',
    title: 'The Growth',
    tagColor: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    description:
      'The platform continues to expand with enhanced features, mobile accessibility, creator tools, marketplace commerce, and innovations built for a global audience.',
  },
]

const values = [
  {
    title: 'Belonging',
    accent: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    description:
      'We believe everyone deserves a place to connect, be heard, and feel at home—wherever they are in the world.',
  },
  {
    title: 'Authenticity',
    accent: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    description:
      'We celebrate real stories, real identities, and real experiences—without dilution.',
  },
  {
    title: 'Diversity',
    accent: 'text-green-600 dark:text-green-400',
    badge: 'bg-green-500/10 text-green-700 dark:text-green-300',
    description:
      'Our strength is our diversity. We amplify voices from every culture, language, and community worldwide.',
  },
  {
    title: 'Innovation',
    accent: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    description:
      'We build technology for people everywhere and push boundaries to redefine what a social platform can be.',
  },
  {
    title: 'Respect',
    accent: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    description:
      'We nurture a safe and respectful environment where debate, culture, and expression can flourish.',
  },
  {
    title: 'Empowerment',
    accent: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    description:
      'We provide tools for individuals, creators, and communities to grow, earn, collaborate, and impact the world.',
  },
]

const OurStory = () => {
  const { user } = useAuth();

  const PrimaryCta: React.FC<{
    href: string;
    children: React.ReactNode;
    className?: string;
  }> = ({ href, children, className = "" }) => (
    <Link
      href={href}
      className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#F97316] px-7 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#EA580C] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 sm:text-base ${className}`}
    >
      {children}
    </Link>
  );

  const SecondaryCta: React.FC<{
    href: string;
    children: React.ReactNode;
    className?: string;
  }> = ({ href, children, className = "" }) => (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-7 py-3 text-sm font-semibold text-[#111827] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#F9FAFB] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-950 sm:text-base ${className}`}
    >
      {children}
    </Link>
  );

  return (
    <div className="relative min-h-screen bg-white font-sans antialiased dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* --- HERO SECTION --- */}

      <section className="bg-gradient-to-br from-[#F97316]/[0.08] via-orange-50/50 to-amber-50/30 p-8 shadow-sm border-b border-[#F97316]/20 dark:border-[#F97316]/30 dark:from-[#F97316]/10 dark:via-slate-900 dark:to-slate-950 sm:p-12">
        {/* Banner Container with #F97316 Warm Tinted Background */}
        <div className="relative overflow-hidden max-w-7xl mx-auto">
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-3xl space-y-5">

              {/* Badge with Theme Color */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F97316]/30 bg-white/80 dark:bg-slate-900/80 px-3.5 py-1 text-xs font-semibold text-[#F97316] dark:text-orange-400 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                CribsTalk Journey
              </div>

              {/* Main Title with #F97316 Warm Gradient */}
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl text-slate-900 dark:text-white leading-[1.1]">
                Redefining How{' '}
                <span className="bg-gradient-to-r from-[#F97316] via-amber-500 to-rose-500 bg-clip-text text-transparent">
                  Communities Connect
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 sm:text-xl">
                From vision to reality — building a global social home for connecting, communicating, and building culture worldwide.
              </p>
            </div>

            {/* Metadata / Stats Strip */}
            <div className="flex items-center gap-6 self-start lg:self-end pt-2">
              <div className="border-l-2 border-[#F97316] pl-4 py-1">
                <span className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Established
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  2024
                </span>
              </div>
              <div className="border-l-2 border-amber-500 pl-4 py-1">
                <span className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Reach
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  100+ Countries
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 lg:px-8 space-y-24">





        {/* --- THE BEGINNING & CORE PURPOSE --- */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

          {/* Main Story Column */}
          <div className="lg:col-span-7 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-8 sm:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <Heart className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                The Beginning
              </h2>
              <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300 sm:text-lg">
                CribsTalk was born from a simple truth: people everywhere hold rich cultures, ideas, and stories — yet those voices are often scattered across platforms, stripped of context, or lost in the noise. We wanted a place that feels like a social home for the world.
              </p>
              <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
                In 2024, technologists, creators, and community leaders came together around one mission: build a global platform for connecting, communicating, sharing, and building communities — open to everyone, everywhere. A digital space where dialogue thrives, culture is celebrated, and people can belong without borders.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Built on trust, cultural protection, and open expression.</span>
            </div>
          </div>

          {/* Mission & Vision Side Column */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-6">
            <div className="flex-1 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Our Mission</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                To help people connect, communicate, and build communities worldwide — amplifying diverse voices, enabling meaningful dialogue, celebrating culture, and creating a global ecosystem where every story matters and every voice is heard.
              </p>
            </div>

            <div className="flex-1 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Lightbulb className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Our Vision</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                A world where people from every background shape global conversations, where cultures are celebrated and protected, and where communities stay deeply connected while building a better future together.
              </p>
            </div>
          </div>

        </section>

        {/* --- OUR JOURNEY --- */}
        <section className="space-y-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Globe className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Our Journey
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {journeyItems.map((item, index) => (
              <div
                key={item.year}
                className="group relative rounded-3xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-7 flex flex-col justify-between space-y-4 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-xl dark:hover:shadow-none"
              >
                <div className="space-y-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${item.tagColor}`}>
                    {item.year}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.description}
                  </p>
                </div>
                <div className="text-xs font-bold text-slate-300 dark:text-slate-700 pt-4 border-t border-slate-100 dark:border-slate-800">
                  0{index + 1}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* --- OUR VALUES --- */}
        <section className="space-y-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Star className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Our Values
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-3xl border border-slate-200/80 bg-slate-50/50 dark:bg-slate-900/40 dark:border-slate-800 p-8 space-y-3 transition-all hover:bg-white dark:hover:bg-slate-900 hover:shadow-lg dark:hover:shadow-none"
              >
                <div className="flex items-center justify-between">
                  <h3 className={`text-xl font-bold ${value.accent}`}>
                    {value.title}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${value.badge}`}>
                    Core
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* --- IMPACT STRIP --- */}
        <section className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 shadow-2xl">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-2 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-emerald-400 uppercase">
                <Users className="h-4 w-4" /> Global Footprint
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Our Growing Impact
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 w-full lg:w-auto text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
              <div className="pt-4 sm:pt-0 sm:px-6">
                <div className="text-4xl font-black text-emerald-400">10,000+</div>
                <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Active Members</div>
              </div>
              <div className="pt-4 sm:pt-0 sm:px-6">
                <div className="text-4xl font-black text-blue-400">100+</div>
                <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Countries</div>
              </div>
              <div className="pt-4 sm:pt-0 sm:px-6">
                <div className="text-4xl font-black text-teal-400">500+</div>
                <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">Cultural Stories</div>
              </div>
            </div>
          </div>
        </section>

        {/* --- TEAM SECTION --- */}
        <section className="space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Meet Our Leadership
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              CribsTalk is built by a passionate team of technologists, creators, and community leaders from around the world.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group rounded-3xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-8 text-center space-y-4 transition-all hover:border-emerald-500/50 hover:shadow-xl dark:hover:shadow-none">
              <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-2xl ring-2 ring-emerald-500/30 group-hover:ring-emerald-500 transition-all duration-300">
                <Image
                  src="/assets/images/team/senyo.jpeg"
                  alt="Senyo Komla Tsedze"
                  width={128}
                  height={128}
                  className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Senyo Komla Tsedze
                </h3>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Founder &amp; CEO
                </p>
              </div>
            </div>

            <div className="group rounded-3xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-8 text-center space-y-4 transition-all hover:border-blue-500/50 hover:shadow-xl dark:hover:shadow-none">
              <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-2xl ring-2 ring-blue-500/30 group-hover:ring-blue-500 transition-all duration-300">
                <Image
                  src="/assets/images/team/eli.jpeg"
                  alt="Eli Orlando Adetor"
                  width={128}
                  height={128}
                  className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Eli Orlando Adetor
                </h3>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  President
                </p>
              </div>
            </div>

            <div className="group rounded-3xl border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800 p-8 text-center space-y-4 transition-all hover:border-green-500/50 hover:shadow-xl dark:hover:shadow-none">
              <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-2xl ring-2 ring-green-500/30 group-hover:ring-green-500 transition-all duration-300">
                <Image
                  src="/assets/images/team/hasan.jfif"
                  alt="Hasan Murtaza"
                  width={128}
                  height={128}
                  className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Hasan Murtaza
                </h3>
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  CTO &amp; Developer
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- CALL TO ACTION --- */}
        <section className="relative overflow-hidden rounded-3xl bg-[#FBF6EF]  p-10 sm:p-16 text-center shadow-sm dark:bg-slate-900/60 dark:border dark:border-slate-800">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-black tracking-tight sm:text-5xl text-contrast dark:text-white">
              Be Part of Our Journey
            </h2>
            <p className="text-base text-[#4B5563] dark:text-slate-300 sm:text-lg">
              CribsTalk&apos;s story is just beginning, and we want you to be part of it. Together, we can connect people worldwide and build bridges that span continents.
            </p>

            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {!user ? (
                <>
                  <PrimaryCta href="/signup" className="w-full sm:w-auto">
                    Join CribsTalk
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </PrimaryCta>
                  <SecondaryCta href="/signin" className="w-full sm:w-auto">
                    Sign In
                  </SecondaryCta>
                </>
              ) : (
                <PrimaryCta href="/feed" className="w-full sm:w-auto">
                  Go to your feed
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </PrimaryCta>
              )}
            </div>

          </div>
        </section>

      </div>
    </div>
  )
}

export default OurStory