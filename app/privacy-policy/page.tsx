'use client'

import { Search, Shield } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

type Section = {
  id: string
  title: string
  keywords: string[]
}

const LAST_UPDATED = 'March 10, 2026'

const SECTIONS: Section[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    keywords: ['overview', 'privacy', 'connectafrik'],
  },
  {
    id: 'information-we-collect',
    title: 'Information We Collect',
    keywords: ['personal information', 'usage data', 'cookies'],
  },
  {
    id: 'how-we-use-information',
    title: 'How We Use Your Information',
    keywords: ['purpose', 'processing', 'communications'],
  },
  {
    id: 'data-security',
    title: 'Data Security',
    keywords: ['protection', 'security', 'safeguards'],
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    keywords: ['access', 'deletion', 'portability'],
  },
  {
    id: 'contact-us',
    title: 'Contact Us',
    keywords: ['support', 'privacy questions', 'email'],
  },
]

const sectionHeadingClasses =
  'scroll-mt-28 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl'

function SectionCard({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8"
      aria-labelledby={`${id}-heading`}
    >
      <div className="mb-5 border-b border-slate-200 pb-4 dark:border-slate-800">
        <h2 id={`${id}-heading`} className={sectionHeadingClasses}>
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
        {children}
      </div>
    </section>
  )
}

const PrivacyPolicyPage = () => {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return SECTIONS
    }

    return SECTIONS.filter(
      section =>
        section.title.toLowerCase().includes(query) ||
        section.keywords.some(keyword => keyword.includes(query))
    )
  }, [searchQuery])

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8 dark:from-slate-950 dark:to-slate-950 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Shield className="h-3.5 w-3.5" />
                Privacy & Data Protection
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                Privacy Policy
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                This policy explains what data we collect, why we collect it, and
                how we protect your information when you use ConnectAfrik.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                Last updated
              </p>
              <time dateTime="2026-03-10">{LAST_UPDATED}</time>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <nav
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5"
              aria-label="Table of contents"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                On this page
              </h2>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search sections..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-emerald-500/30 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-emerald-400"
                  aria-label="Search policy sections"
                />
              </div>

              <ul className="space-y-1.5">
                {filteredSections.map(section => (
                  <li key={section.id}>
                    <Link
                      href={`#${section.id}`}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                    >
                      {section.title}
                    </Link>
                  </li>
                ))}
                {filteredSections.length === 0 && (
                  <li className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No section matches your search.
                  </li>
                )}
              </ul>
            </nav>
          </aside>

          <article className="space-y-6 [scroll-behavior:smooth]">
            <div className="rounded-2xl border-l-4 border-emerald-500 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              Important: By using ConnectAfrik, you agree to this policy and
              consent to data processing as described below.
            </div>

            <SectionCard id="introduction" title="Introduction">
              <p>
                At ConnectAfrik, we respect your privacy and are committed to
                protecting your personal data. This privacy policy describes how
                we collect, use, and safeguard your information when you use our
                platform.
              </p>
              <p>
                We process personal data transparently and only for legitimate
                business and legal purposes.
              </p>
            </SectionCard>

            <SectionCard
              id="information-we-collect"
              title="Information We Collect"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                    Personal Information
                  </h3>
                  <p className="mb-3">
                    We collect information you provide directly, including:
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Name and email address</li>
                    <li>Profile information and photos</li>
                    <li>Content you post or share</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                    Usage Data
                  </h3>
                  <p className="mb-3">
                    We automatically collect interaction data, such as:
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Device and browser information</li>
                    <li>IP address and location signals</li>
                    <li>Cookies and similar technologies</li>
                  </ul>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="how-we-use-information"
              title="How We Use Your Information"
            >
              <ul className="list-disc space-y-1 pl-5">
                <li>Provide, maintain, and improve our services</li>
                <li>Communicate with you about your account and support</li>
                <li>Personalize your in-product experience</li>
                <li>Prevent fraud and protect platform security</li>
                <li>Comply with legal and regulatory obligations</li>
              </ul>
            </SectionCard>

            <SectionCard id="data-security" title="Data Security">
              <p>
                We implement technical and organizational safeguards to protect
                personal data against unauthorized access, loss, disclosure,
                misuse, and alteration.
              </p>
              <p>
                Security controls are reviewed periodically to keep pace with new
                threats and platform changes.
              </p>
            </SectionCard>

            <SectionCard id="your-rights" title="Your Rights">
              <p>You may have the right to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Access your personal data</li>
                <li>Correct inaccurate or incomplete information</li>
                <li>Request deletion of personal data</li>
                <li>Object to certain processing activities</li>
                <li>Request data portability where applicable</li>
              </ul>
            </SectionCard>

            <SectionCard id="contact-us" title="Contact Us">
              <p>
                If you have questions about this Privacy Policy, contact us at{' '}
                <a
                  href="mailto:wlivinston21@gmail.com"
                  className="font-medium text-emerald-700 underline underline-offset-2 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  wlivinston21@gmail.com
                </a>
                .
              </p>
            </SectionCard>
          </article>
        </div>
      </div>
    </main>
  )
}

export default PrivacyPolicyPage
