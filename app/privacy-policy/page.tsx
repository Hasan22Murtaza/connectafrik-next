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
  { id: 'who-we-are', title: '1. Who We Are', keywords: ['platform', 'profiles', 'communities'] },
  { id: 'scope-target-regions', title: '2. Scope & Target Regions', keywords: ['gdpr', 'global', 'laws'] },
  { id: 'key-terms', title: '3. Key Terms', keywords: ['personal data', 'sensitive', 'controller'] },
  { id: 'information-we-collect', title: '4. Information We Collect', keywords: ['account', 'content', 'device'] },
  { id: 'how-we-use-information', title: '5. Use & Legal Bases', keywords: ['legal bases', 'gdpr article 6'] },
  { id: 'cookies', title: '6. Cookies, Pixels & SDKs', keywords: ['cookies', 'ads', 'preferences'] },
  { id: 'sharing', title: '7. Sharing & Disclosures', keywords: ['processors', 'partners', 'legal'] },
  { id: 'international-transfers', title: '8. International Transfers', keywords: ['sccs', 'idta', 'uk addendum'] },
  { id: 'retention', title: '9. Data Retention', keywords: ['retention', 'backup', 'deletion'] },
  { id: 'choices-controls', title: '10. Your Choices & Controls', keywords: ['settings', 'opt out', 'permissions'] },
  { id: 'your-rights', title: '11. Your Rights', keywords: ['access', 'erasure', 'portability'] },
  { id: 'children', title: "12. Children's Privacy", keywords: ['children', 'coppa', 'minors'] },
  { id: 'safety-automation', title: '13. Safety & Automated Decisions', keywords: ['moderation', 'appeals', 'profiling'] },
  { id: 'messaging-encryption', title: '14. Messaging, Calls & Encryption', keywords: ['dm', 'calls', 'encryption'] },
  { id: 'sensitive-data', title: '15. Sensitive Data', keywords: ['biometrics', 'precise location', 'consent'] },
  { id: 'third-party', title: '16. Third-Party Integrations', keywords: ['sso', 'embeds', 'links'] },
  { id: 'security', title: '17. Security', keywords: ['mfa', 'sdlc', 'breach'] },
  { id: 'breach-policy', title: '18. Breach Notification Policy', keywords: ['incident response', '72 hours'] },
  { id: 'privacy-by-design', title: '19. Data Minimization & Privacy by Design', keywords: ['dpia', 'defaults'] },
  { id: 'policy-changes', title: '20. Changes to This Policy', keywords: ['updates', 'notice'] },
  { id: 'contact-us', title: '21. How to Contact Us', keywords: ['privacy office', 'dpo', 'support'] },
  { id: 'region-specific', title: '22. Region-Specific Notices', keywords: ['eu', 'us', 'canada', 'africa', 'asia'] },
  { id: 'processing-annex', title: '23. Data Processing Annex', keywords: ['categories', 'purposes', 'retention'] },
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
                This policy explains how ConnectAfrik collects, uses, shares,
                transfers, protects, and retains personal information, and
                describes your rights and choices.
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
              className="max-h-[78vh] space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5"
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
              consent to processing as described below, subject to your local
              legal rights and controls.
            </div>

            <SectionCard id="who-we-are" title="1) Who We Are">
              <p>
                ConnectAfrik.com operates a social platform that enables people
                to create profiles, connect, share content, and discover
                communities and events.
              </p>
              <p>
                This policy explains how we collect, use, share, and protect
                personal information, and describes your choices and rights.
              </p>
            </SectionCard>

            <SectionCard id="scope-target-regions" title="2) Scope & Target Regions">
              <p>
                This policy applies to our website, mobile apps, APIs, SDKs,
                and related services, and to visitors, registered users,
                creators, advertisers, business partners, and developers.
              </p>
              <p>
                <strong>Target Regions:</strong> ConnectAfrik.com is a global
                platform and provides services to users in Europe (EEA), the
                United Kingdom, the United States, Canada, Africa, Asia, and
                other international locations. We comply with applicable privacy
                laws in these regions, including but not limited to GDPR (EU),
                UK GDPR, U.S. state privacy laws (for example CPRA/CCPA, VCDPA,
                CPA, CTDPA, UCPA, MHMDA), Canada&apos;s PIPEDA (and provincial
                laws), South Africa&apos;s POPIA, Nigeria&apos;s NDPR/NDPA, Kenya&apos;s
                DPA 2019, India&apos;s DPDP Act, Singapore PDPA, Philippines DPA,
                Malaysia PDPA, Indonesia PDP Law, China PIPL, and Japan APPI.
                See Section 22 for detailed region-specific notices.
              </p>
              <p>
                This policy does not apply to third-party websites, apps, or
                services that link to or integrate with our Services. Their
                practices are governed by their own policies.
              </p>
            </SectionCard>

            <SectionCard id="key-terms" title="3) Key Terms (Plain Language)">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>Personal Information / Personal Data:</strong> Info
                  that identifies or relates to an identifiable person (for
                  example name, email, IP address, device ID).
                </li>
                <li>
                  <strong>Sensitive Personal Information:</strong> Categories
                  needing extra protection (for example precise location,
                  contacts, biometrics, racial or ethnic origin, health data,
                  union membership, sexual orientation).
                </li>
                <li>
                  <strong>Processing:</strong> Any operation on personal data
                  (collecting, storing, using, sharing, deleting).
                </li>
                <li>
                  <strong>Controller / Processor (GDPR):</strong> The
                  controller decides purposes and means of processing; a
                  processor acts on behalf of a controller.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="information-we-collect" title="4) Information We Collect">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                    4.1 Information You Provide
                  </h3>
                  <ul className="list-disc space-y-1.5 pl-5">
                    <li>
                      <strong>Account &amp; Profile:</strong> Name,
                      username/handle, email or phone, password, profile photo,
                      pronouns, birthday, gender, interests, short bio.
                    </li>
                    <li>
                      <strong>Content:</strong> Posts, photos, videos, comments,
                      stories, live streams, events, groups, captions, tags,
                      hashtags, and associated metadata.
                    </li>
                    <li>
                      <strong>Social Graph:</strong> Followers/following/friends,
                      invites, blocks, mutes, lists.
                    </li>
                    <li>
                      <strong>Communications:</strong> Direct messages (DMs),
                      group chats, calls, support tickets, feedback.
                    </li>
                    <li>
                      <strong>Identity &amp; Safety:</strong> Government ID (for
                      verification), liveness checks (selfies), appeals,
                      reports/flags, trust and safety submissions.
                    </li>
                    <li>
                      <strong>Payments &amp; Commerce:</strong> Purchases,
                      subscriptions, shipping/billing details and payout info
                      (processed via payment processor).
                    </li>
                    <li>
                      <strong>Creator/Advertiser Tools:</strong> Ad accounts,
                      audiences, brand safety settings, campaign metrics.
                    </li>
                    <li>
                      <strong>Surveys &amp; Beta Programs:</strong> Feedback and
                      testing inputs.
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                    4.2 Information We Collect Automatically
                  </h3>
                  <ul className="list-disc space-y-1.5 pl-5">
                    <li>
                      <strong>Usage &amp; Logs:</strong> Features used, clicks,
                      timestamps, session duration, referring and exit pages.
                    </li>
                    <li>
                      <strong>Device &amp; Network:</strong> IP address,
                      device/advertising IDs, OS/app version, browser type,
                      language, mobile carrier, screen size, crash and
                      diagnostic logs.
                    </li>
                    <li>
                      <strong>Location:</strong> Approximate location from IP;
                      optional precise location only with permission.
                    </li>
                    <li>
                      <strong>Cookies/Local Storage/SDKs/Pixels:</strong> For
                      authentication, security, preferences, analytics, and ads
                      measurement/personalization where permitted.
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                    4.3 Information from Others
                  </h3>
                  <ul className="list-disc space-y-1.5 pl-5">
                    <li>
                      <strong>Contacts (opt-in):</strong> If you find friends or
                      invite contacts.
                    </li>
                    <li>
                      <strong>Other Users:</strong> Mentions, tags, messages,
                      reports about you.
                    </li>
                    <li>
                      <strong>Partners &amp; Advertisers:</strong> Audience
                      segments, conversion events, engagement signals.
                    </li>
                    <li>
                      <strong>Third-Party Logins:</strong> If you sign up using
                      Apple/Google/etc., we receive info consistent with your
                      permissions.
                    </li>
                  </ul>
                </div>
              </div>
              <p>
                <strong>Messaging Encryption:</strong> We offer end-to-end
                encryption for 1:1 chats/calls when enabled. See Section 14.
              </p>
            </SectionCard>

            <SectionCard id="how-we-use-information" title="5) How We Use Your Information & Legal Bases">
              <p>We use your information to:</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-[740px] w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Purpose</th>
                      <th className="px-4 py-3 font-semibold">Examples</th>
                      <th className="px-4 py-3 font-semibold">Legal Bases (GDPR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Account setup & authentication', 'Registration, login, account recovery', 'Contract; Legitimate interests; Consent (where required)'],
                      ['Provide core features', 'Posts, feed, groups, DMs, calls, events', 'Contract'],
                      ['Personalize content', 'Recommendations, ranking, suggested connections', 'Legitimate interests; Consent (for certain cookies/ads)'],
                      ['Safety & integrity', 'Abuse/fraud/spam/malware detection, moderation, appeals', 'Legal obligation; Vital interests; Legitimate interests'],
                      ['Advertising & measurement', 'Interest-based ads, conversions, frequency capping', 'Consent (where required); Legitimate interests'],
                      ['Analytics & improvement', 'Diagnostics, performance, A/B testing, research', 'Legitimate interests'],
                      ['Communications', 'Service notices, transactional emails, marketing', 'Contract; Consent (marketing)'],
                      ['Payments & tax', 'Purchases, subscriptions, payouts, compliance', 'Contract; Legal obligation'],
                      ['Compliance & enforcement', 'Respond to legal requests, disputes, enforce terms', 'Legal obligation; Legitimate interests'],
                    ].map(row => (
                      <tr key={row[0]} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-4 py-3">{row[0]}</td>
                        <td className="px-4 py-3">{row[1]}</td>
                        <td className="px-4 py-3">{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard id="cookies" title="6) Cookies, Pixels & SDKs">
              <p>
                We use first- and third-party cookies, local storage, pixels,
                and SDKs to keep you logged in, secure the Services, remember
                preferences, analyze performance, personalize content, and
                measure/serve ads where permitted.
              </p>
              <p>
                Manage cookies and ad preferences in Settings {'->'} Privacy {'->'}
                Cookies &amp; Ads or via system-level controls. See our Cookie
                Notice.
              </p>
            </SectionCard>

            <SectionCard id="sharing" title="7) Sharing & Disclosures">
              <p>We share information with:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Service Providers/Processors:</strong> Hosting,
                  storage/CDN, analytics, security, payments, SMS/email, support.
                </li>
                <li>
                  <strong>Business Partners:</strong> Third-party app
                  connections, SSO, and partner programs.
                </li>
                <li>
                  <strong>Advertisers &amp; Measurement Partners:</strong>{' '}
                  Aggregated/pseudonymized data for delivery and measurement;
                  never your private DMs.
                </li>
                <li>
                  <strong>Other Users:</strong> Based on your visibility
                  settings, tags/comments/interactions.
                </li>
                <li>
                  <strong>Legal &amp; Safety:</strong> To comply with law or
                  protect rights, safety, and platform integrity.
                </li>
                <li>
                  <strong>Corporate Transactions:</strong> Mergers, acquisitions,
                  or asset transfers, subject to safeguards.
                </li>
              </ul>
              <p>
                We do not sell personal information for money. Some jurisdictions
                may consider certain ad activity a sale/share. See region-specific
                notices for opt-out rights.
              </p>
            </SectionCard>

            <SectionCard id="international-transfers" title="8) International Data Transfers">
              <p>
                We operate globally. Where data is transferred to countries with
                different protections, we use recognized safeguards (for example
                EU SCCs, UK Addendum/IDTA) and conduct risk assessments as
                required.
              </p>
            </SectionCard>

            <SectionCard id="retention" title="9) Data Retention">
              <p>
                We keep personal information only as long as necessary for the
                purposes described or as required by law.
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-[620px] w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Typical retention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Account profile', 'Life of account; deleted within 30 days after account deletion'],
                      ['Posts & media', 'Per your settings; deleted within 30 days after deletion'],
                      ['Logs & analytics', '12-24 months, then aggregated or anonymized'],
                      ['Safety & integrity records', 'Up to 5 years (for repeat abuse/fraud detection)'],
                      ['Payments & tax', 'As required by law (for example 7 years)'],
                      ['Backups', 'Persist up to 35 days, then securely purged'],
                    ].map(row => (
                      <tr key={row[0]} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-4 py-3">{row[0]}</td>
                        <td className="px-4 py-3">{row[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard id="choices-controls" title="10) Your Choices & Controls">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Privacy settings:</strong> Control visibility of your
                  profile, posts, and activity.
                </li>
                <li>
                  <strong>Ad preferences:</strong> Manage interests,
                  off-platform signals, and opt out where applicable.
                </li>
                <li>
                  <strong>Cookie controls:</strong> Adjust or withdraw consent
                  where required.
                </li>
                <li>
                  <strong>Communications:</strong> Opt out of marketing
                  emails/SMS in messages or settings.
                </li>
                <li>
                  <strong>Permissions:</strong> Revoke contacts, camera,
                  microphone, or precise location in device settings.
                </li>
                <li>
                  <strong>Connected accounts:</strong> Disconnect third-party
                  logins anytime.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="your-rights" title="11) Your Rights (Comprehensive)">
              <p>Your rights depend on your location, but may include:</p>
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>
                  <strong>Access</strong> — Obtain a copy of your personal
                  information.
                </li>
                <li>
                  <strong>Correction (Rectification)</strong> — Fix inaccurate
                  or incomplete data.
                </li>
                <li>
                  <strong>Deletion (Erasure)</strong> — Request deletion of your
                  data, subject to lawful exceptions.
                </li>
                <li>
                  <strong>Portability</strong> — Receive your data in a portable
                  format and/or request transfer.
                </li>
                <li>
                  <strong>Restriction</strong> — Ask us to limit certain
                  processing.
                </li>
                <li>
                  <strong>Objection</strong> — Object to processing based on
                  legitimate interests, including profiling.
                </li>
                <li>
                  <strong>Withdraw Consent</strong> — Where processing relies on
                  consent.
                </li>
                <li>
                  <strong>Opt-Out of Sale/Sharing or Targeted Advertising</strong>{' '}
                  — Where applicable.
                </li>
                <li>
                  <strong>Limit Use of Sensitive Personal Information</strong> —
                  In jurisdictions such as California.
                </li>
                <li>
                  <strong>Automated Decision-Making &amp; Profiling</strong> —
                  Request information/human review where required.
                </li>
                <li>
                  <strong>Non-Discrimination/Non-Retaliation</strong> — No
                  discrimination for exercising rights.
                </li>
                <li>
                  <strong>Complain to a Regulator</strong> — Lodge a complaint
                  with your supervisory authority.
                </li>
              </ol>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  How to exercise your rights
                </p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>
                    Use Settings {'->'} Privacy {'->'} Your Data for self-service
                    tools.
                  </li>
                  <li>
                    Or email{' '}
                    <a
                      href="mailto:info@connectafric.com"
                      className="font-medium text-emerald-700 underline underline-offset-2 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      info@connectafric.com
                    </a>{' '}
                    with your request and locale.
                  </li>
                  <li>Verification may be required to confirm identity.</li>
                  <li>
                    Response timelines include: GDPR (1 month, extendable by 2
                    months), California (45 days, extendable by 45 days), Canada
                    (30 days, extendable as permitted).
                  </li>
                </ul>
              </div>
            </SectionCard>

            <SectionCard id="children" title="12) Children&apos;s Privacy">
              <p>
                ConnectAfrik is not directed to children under [13/16, depending
                on jurisdiction]. We do not knowingly collect personal
                information from children without appropriate parental consent as
                required by law.
              </p>
              <p>
                If you believe a child has provided personal information, contact
                us so we can delete it.
              </p>
            </SectionCard>

            <SectionCard id="safety-automation" title="13) Safety, Integrity & Automated Decision-Making">
              <p>
                We use automated tools and human reviewers to detect and reduce
                spam, scams, malware, impersonation, hateful or violent content,
                and other policy violations; to limit harmful misinformation; and
                to enforce our Community Standards and Terms.
              </p>
              <p>
                Automated decision-making may affect content ranking, account
                limits, or ad eligibility. You can appeal via Help {'->'} Appeals
                and request human review where required by law.
              </p>
            </SectionCard>

            <SectionCard id="messaging-encryption" title="14) Messaging, Calls & Encryption">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>DMs and Calls:</strong> We process metadata
                  (participants, timestamps, delivery status) to deliver
                  communications and prevent abuse.
                </li>
                <li>
                  <strong>Encryption:</strong> End-to-end encryption may be
                  enabled for 1:1 chats/calls when both parties opt in. Group
                  chats are encrypted in transit and may support end-to-end
                  encryption where available.
                </li>
                <li>
                  <strong>Reporting:</strong> If content is reported, we may
                  process relevant messages and, if necessary, decrypt content
                  where technically possible and lawful to investigate violations.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="sensitive-data" title="15) Sensitive Data">
              <p>
                We do not require sensitive personal information to use core
                features. If you choose to share sensitive data in your profile
                or posts, it may be visible based on your settings.
              </p>
              <p>
                Where we process sensitive signals (for example precise location,
                contacts upload, or biometrics for verification), we request
                consent or rely on another lawful basis and apply enhanced
                safeguards.
              </p>
            </SectionCard>

            <SectionCard id="third-party" title="16) Third-Party Integrations & Links">
              <p>
                Our Services may contain links or integrations (embeds, SDKs,
                SSO) from third parties. Their practices are governed by their
                own policies. Review them carefully.
              </p>
            </SectionCard>

            <SectionCard id="security" title="17) Security">
              <p>
                We implement administrative, technical, and physical safeguards,
                including encryption at rest and in transit for key data, access
                controls with MFA, network monitoring, secure SDLC, regular
                testing, and vetted vendor contracts.
              </p>
              <p>
                No system is 100% secure. If a breach occurs, we will notify you
                and regulators as required (see Section 18).
              </p>
            </SectionCard>

            <SectionCard id="breach-policy" title="18) Data Breach Notification Policy (Incident Response)">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                18.1 Definition
              </h3>
              <p>
                A personal data breach is a security incident leading to
                accidental or unlawful destruction, loss, alteration,
                unauthorized disclosure of, or access to personal information.
              </p>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                18.2 Roles &amp; Responsibility
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>Incident Response Lead (IR Lead): response coordination.</li>
                <li>Security Team: detection, containment, forensics, remediation.</li>
                <li>Privacy/DPO &amp; Legal: risk and notification analysis.</li>
                <li>Communications: user/regulator notices and FAQs.</li>
                <li>Engineering/IT: technical fixes, logging, hardening.</li>
                <li>Support: user inquiries and identity-protection support.</li>
              </ul>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                18.3 Detection, Triage, and Containment
              </h3>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Detect and log incident; open severity-rated ticket.</li>
                <li>Contain (revoke keys, block access, isolate systems).</li>
                <li>Preserve evidence for forensic analysis.</li>
                <li>Engage vendors/subprocessors and request breach details.</li>
              </ol>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                18.4 Assessment of Risk &amp; Scope
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>Identify data types/users affected and misuse risk.</li>
                <li>Assess harm severity (identity theft, loss, safety risks).</li>
                <li>Determine if user/regulator notifications are required.</li>
              </ul>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                18.5 Notification Triggers &amp; Timelines (Illustrative)
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>EU/UK:</strong> Authority notification within 72 hours
                  when required; notify individuals without undue delay for high
                  risk.
                </li>
                <li>
                  <strong>Canada (PIPEDA):</strong> Report as soon as feasible
                  for real risk of significant harm and maintain breach records
                  for at least 24 months.
                </li>
                <li>
                  <strong>United States:</strong> Notify affected residents in
                  the most expedient time possible and without unreasonable
                  delay, subject to state rules.
                </li>
                <li>
                  <strong>Africa:</strong> POPIA as soon as reasonably possible;
                  NDPR/Kenya guidance generally within 72 hours.
                </li>
                <li>
                  <strong>Asia:</strong> Notify regulators/users without undue
                  delay, per local laws.
                </li>
              </ul>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                18.6 Contents of Notices
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>Nature of incident, dates, discovery date.</li>
                <li>Types of information involved and likely consequences.</li>
                <li>Measures taken/proposed and user protective steps.</li>
                <li>Contact channels and regulator follow-up details.</li>
              </ul>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                18.7 Methods of Notice
              </h3>
              <p>
                Email, in-app messages, website notice, postal mail where
                required, and regulator-specified forms/portals.
              </p>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                18.8 Recordkeeping &amp; Post-Incident Review
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Maintain a breach register (facts, effects, remediation) for
                  legal retention periods.
                </li>
                <li>
                  Conduct post-mortem within 14 days; implement corrective
                  actions and update policies/training.
                </li>
                <li>
                  Brief management and publish transparency updates where
                  appropriate.
                </li>
              </ul>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                18.9 Contact for Breach Inquiries
              </h3>
              <p>
                Email{' '}
                <a
                  href="mailto:info@connectafric.com"
                  className="font-medium text-emerald-700 underline underline-offset-2 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  info@connectafric.com
                </a>{' '}
                or{' '}
                <a
                  href="mailto:info@connectafric.com"
                  className="font-medium text-emerald-700 underline underline-offset-2 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  info@connectafric.com
                </a>
                .
              </p>
            </SectionCard>

            <SectionCard id="privacy-by-design" title="19) Data Minimization & Privacy by Design">
              <p>
                We collect only what we need, enable privacy-protective defaults
                where feasible, conduct DPIAs for high-risk features (for
                example face recognition, precise location, minors), and regularly
                review data retention and access permissions.
              </p>
            </SectionCard>

            <SectionCard id="policy-changes" title="20) Changes to This Policy">
              <p>
                We may update this policy to reflect changes in our practices or
                legal requirements. We will post the updated version with a new
                Last updated date.
              </p>
              <p>
                For material changes, we will provide additional notice (for
                example email or in-app notice).
              </p>
            </SectionCard>

            <SectionCard id="contact-us" title="21) How to Contact Us">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                Privacy inquiries and rights requests
              </p>
              <p>ConnectAfrik.com (legal entity: [ConnectAfrik, Inc./Ltd.])</p>
              <p>Attn: Privacy Office / DPO</p>
              <p>[Address, City, Country, Postal Code]</p>
              <p>
                Email:{' '}
                <a
                  href="mailto:info@connectafric.com"
                  className="font-medium text-emerald-700 underline underline-offset-2 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  info@connectafric.com
                </a>
              </p>
              <p>
                Support:{' '}
                <a
                  href="mailto:info@connectafric.com"
                  className="font-medium text-emerald-700 underline underline-offset-2 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  info@connectafric.com
                </a>{' '}
                or in-app Help.
              </p>
            </SectionCard>

            <SectionCard id="region-specific" title="22) Region-Specific Notices">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    22.1 European Union / EEA (GDPR)
                  </h3>
                  <p>
                    Rights include access, rectification, erasure, portability,
                    restriction, objection, and withdrawal of consent. We rely on
                    Article 6 GDPR legal bases and use SCCs with supplementary
                    safeguards for transfers.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    22.2 United Kingdom (UK GDPR)
                  </h3>
                  <p>
                    Similar rights to GDPR with ICO oversight. Transfers rely on
                    UK Addendum or IDTA where applicable.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    22.3 United States (State Privacy Laws)
                  </h3>
                  <p>
                    Depending on state law, rights may include know/access,
                    delete, correct, opt out of targeted advertising/sale/sharing,
                    limit use of sensitive data, portability, and appeal rights.
                    Where required, we provide a Do Not Sell or Share My Personal
                    Information link.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    22.4 Canada (PIPEDA & Provincial Laws)
                  </h3>
                  <p>
                    Rights include access, correction, and withdrawal of consent
                    subject to legal limits. We maintain breach logs for at least
                    24 months and comply with applicable provincial requirements
                    (for example Quebec Law 25, Alberta PIPA, BC PIPA).
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    22.5 Africa (POPIA, NDPR/NDPA, Kenya DPA, Others)
                  </h3>
                  <p>
                    We align processing and rights handling with applicable
                    African laws, including access, correction, erasure/objection
                    rights and timely breach notices under local requirements.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    22.6 Asia (DPDP, PDPA, PIPL, APPI, Others)
                  </h3>
                  <p>
                    We respect local frameworks for consent, access/correction,
                    deletion where applicable, transfer safeguards, and breach
                    notifications across jurisdictions such as India, Singapore,
                    China, Japan, and others.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard id="processing-annex" title="23) Data Processing Annex (Overview)">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                A. Data Categories &amp; Purposes Matrix (Example)
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-[860px] w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Elements</th>
                      <th className="px-4 py-3 font-semibold">Purpose(s)</th>
                      <th className="px-4 py-3 font-semibold">Retention</th>
                      <th className="px-4 py-3 font-semibold">Legal Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Profile', 'Name, username, photo, bio', 'Account, social features', 'Life of account', 'Contract'],
                      ['Content', 'Posts, images, videos, captions', 'Sharing, discovery, recommendations', 'User control + 35 days backup', 'Contract; Legitimate interests'],
                      ['Communications', 'DMs, calls metadata', 'Delivery, safety', 'Life of account + 12 months logs', 'Contract; Legitimate interests'],
                      ['Device/Logs', 'IP, device ID, diagnostics', 'Security, analytics', '12-24 months', 'Legitimate interests'],
                      ['Location', 'Approx IP; precise (opt-in)', 'Personalization, safety', '12 months', 'Consent (precise); Legitimate interests'],
                      ['Payments', 'Transactions (via processor)', 'Purchases, compliance', '7 years', 'Contract; Legal obligation'],
                      ['Safety Signals', 'Reports, blocks, abuse patterns', 'Enforcement, integrity', 'Up to 5 years', 'Legitimate interests; Legal obligation'],
                    ].map(row => (
                      <tr key={row[0]} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-4 py-3">{row[0]}</td>
                        <td className="px-4 py-3">{row[1]}</td>
                        <td className="px-4 py-3">{row[2]}</td>
                        <td className="px-4 py-3">{row[3]}</td>
                        <td className="px-4 py-3">{row[4]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </article>
        </div>
      </div>
    </main>
  )
}

export default PrivacyPolicyPage
