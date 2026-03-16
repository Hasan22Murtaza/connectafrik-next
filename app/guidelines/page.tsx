'use client'

import { FileText, Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

type Section = {
  id: string
  title: string
  keywords: string[]
}

const EFFECTIVE_DATE = '[Month Day, Year]'
const LAST_UPDATED = '[Month Day, Year]'

const SECTIONS: Section[] = [
  { id: 'core-principles', title: '1. Core Principles', keywords: ['safety', 'respect', 'authenticity'] },
  { id: 'not-allowed', title: "2. What's Not Allowed", keywords: ['child safety', 'harassment', 'spam'] },
  { id: 'allowed-with-care', title: '3. What Is Allowed (with Care)', keywords: ['newsworthy', 'graphic', 'medical claims'] },
  { id: 'minors', title: '4. Safety of Minors', keywords: ['age', 'parents', 'caregiver'] },
  { id: 'creator-responsibilities', title: '5. Creator & Group Responsibilities', keywords: ['moderation', 'live streams', 'monetization'] },
  { id: 'labels-distribution', title: '6. Labels & Distribution Controls', keywords: ['age gates', 'warnings', 'downrank'] },
  { id: 'enforcement', title: '7. Enforcement & Penalties', keywords: ['strikes', 'bans', 'suspension'] },
  { id: 'reporting-appeals', title: '8. Reporting, Appeals & Transparency', keywords: ['report', 'appeal', 'transparency'] },
  { id: 'safety-tools', title: '9. Tools to Protect Yourself', keywords: ['block', 'mute', 'mfa'] },
  { id: 'synthetic-content', title: '10. Media Integrity & Synthetic Content', keywords: ['ai generated', 'deepfake', 'manipulated media'] },
  { id: 'ads-promotions', title: '11. Marketplace, Ads & Paid Promotions', keywords: ['sponsored', 'financial', 'political ads'] },
  { id: 'ip-detail', title: '12. Intellectual Property', keywords: ['copyright', 'trademark', 'counter notice'] },
  { id: 'local-law', title: '13. Local Law & Regional Sensitivities', keywords: ['georestrict', 'compliance'] },
  { id: 'law-enforcement', title: '14. Law Enforcement Requests', keywords: ['legal process', 'government'] },
  { id: 'account-security', title: '15. Account Security & Misuse', keywords: ['phishing', 'password', 'compromise'] },
  { id: 'education-help', title: '16. Education, Resources & Help', keywords: ['help center', 'creators hub'] },
  { id: 'changes', title: '17. Changes to Guidelines', keywords: ['material changes', 'update'] },
  { id: 'contact', title: '18. Contact Us', keywords: ['policy', 'safety', 'ip'] },
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

const GuidelinesPage = () => {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return SECTIONS
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
                <FileText className="h-3.5 w-3.5" />
                Trust & Safety
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                Community Guidelines
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                Welcome to ConnectAfrik. Our mission is to help people connect,
                create, and thrive safely. These guidelines explain what is and
                is not allowed and how enforcement works.
              </p>
            </div>
           
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <nav
              className="max-h-[78vh] space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5"
              aria-label="Community guidelines table of contents"
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
                  aria-label="Search guideline sections"
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
           

            <SectionCard id="core-principles" title="1) Core Principles">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Safety first:</strong> Content or behavior that risks
                  harm to people online or offline has no place here.
                </li>
                <li>
                  <strong>Dignity &amp; respect:</strong> Do not attack, demean,
                  exploit, or silence others.
                </li>
                <li>
                  <strong>Authenticity:</strong> Be who you say you are. No
                  impersonation, coordinated manipulation, or spam.
                </li>
                <li>
                  <strong>Responsibility to community:</strong> Your rights come
                  with responsibilities. Help keep ConnectAfrik welcoming and
                  trust worthy.
                </li>
                <li>
                  <strong>Compliance:</strong> Follow local laws and our
                  policies, especially on child safety, privacy, and
                  intellectual property.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="not-allowed" title="2) What&apos;s Not Allowed ">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.1 Child Safety (Zero Tolerance)
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Absolutely prohibited: any content that sexualizes,
                      exploits, or endangers minors, grooming, solicitation, or
                      instructions to harm or abuse children.
                    </li>
                    <li>
                      Do not post, share, or request images of minors in
                      sexualized contexts.
                    </li>
                    <li>
                      We report apparent child endangerment to relevant
                      authorities where legally required.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.2 Sexual Content & Exploitation
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Pornographic content and sexual solicitation are prohibited.</li>
                    <li>
                      Nonconsensual or exploitative sexual content (including
                      upskirting, deepfake sexual content, or revenge porn) is
                      banned.
                    </li>
                    <li>
                      Age-restricted content is not allowed. Keep ConnectAfrik
                      safe for a general audience.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.3 Harassment & Hate
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Harassment and bullying: No targeted insults, slurs,
                      doxxing, stalking, or encouragement of harassment.
                    </li>
                    <li>
                      Hate speech: No content attacking people based on
                      protected characteristics.
                    </li>
                    <li>
                      Dehumanization and segregation are prohibited.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.4 Violence, Threats & Criminal Activity
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Threats of violence or wishes for harm are forbidden.</li>
                    <li>
                      Praising, supporting, or recruiting for violent
                      organizations is prohibited.
                    </li>
                    <li>
                      No instructions to commit crimes or facilitate fraud,
                      money laundering, weapons/drug sales, or related crimes.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.5 Self-Harm & Suicide
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Prohibited: content that promotes, instructs, or glorifies
                      self-harm or suicide.
                    </li>
                    <li>
                      Allowed with care: first-person recovery or supportive
                      resources, without graphic detail or instructions.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.6 Misinformation & Civic Integrity
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Harmful misinformation that risks real-world harm may be
                      removed or labeled.
                    </li>
                    <li>
                      No deception about voting eligibility, dates, locations, or
                      methods of civic participation.
                    </li>
                    <li>
                      We may downrank, label, or remove false claims based on
                      context, harm, and authoritative sources.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.7 Privacy & Personal Data
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>No sharing of personal data without consent.</li>
                    <li>No intimate images or recordings shared without consent.</li>
                    <li>Respect privacy settings and legal rights.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.8 Intellectual Property (IP)
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Do not post content you do not have rights to.</li>
                    <li>
                      Copyright and trademark violations will be removed upon
                      notice, repeat infringers may lose accounts.
                    </li>
                    <li>Use licensed media or your own content.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.9 Impersonation & Misleading Behavior
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>No pretending to be another person or brand.</li>
                    <li>Parody/satire accounts must be clearly labeled.</li>
                    <li>No fake engagement, bot amplification, or manipulation.</li>
                    <li>Coordinated disinformation campaigns are prohibited.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.10 Spam & Platform Abuse
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>No bulk repetitive posting, link-farming, or deceptive redirects.</li>
                    <li>No malware, phishing, credential theft, or scams.</li>
                    <li>
                      Misuse of reporting or appeals tools may result in limits
                      or suspension.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    2.11 Regulated Goods & Services
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Illegal or regulated goods promotions (for example drugs or
                      counterfeit goods) are prohibited.
                    </li>
                    <li>
                      Additional restrictions apply to alcohol, tobacco,
                      gambling, dating, and financial services.
                    </li>
                  </ul>
                </div>
              </div>
            </SectionCard>

            <SectionCard id="allowed-with-care" title="3) What Is Allowed">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Newsworthy or educational content on sensitive topics may be
                  allowed with context, labels, and reduced distribution.
                </li>
                <li>
                  Graphic content must be clearly labeled, not glorify harm, and
                  avoid shocking thumbnails.
                </li>
                <li>
                  Health and safety discourse is allowed, but medical claims
                  require credible sources.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="minors" title="4) Safety of Minors & Age-Appropriate Design">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  You must meet the minimum age required in your region to use
                  ConnectAfrik.
                </li>
                <li>Do not solicit minors or exchange private contact details.</li>
                <li>
                  Features may work differently for young users (stricter
                  discovery/messaging controls).
                </li>
                <li>
                  Parents and guardians should review our Caregiver Guide for
                  safety tools.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="creator-responsibilities" title="5) Creator & Group Responsibilities">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Creators and group admins must actively moderate their spaces.
                </li>
                <li>
                  Live streams/events should use slow mode, keyword bans, and
                  moderators.
                </li>
                <li>
                  Monetization access may be removed for policy violations.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="labels-distribution" title="6) Content Labels & Distribution Controls">
              <p>
                We may use labels, age gates, reduced amplification, or
                interstitial warnings for:
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Sensitive or graphic content with context</li>
                <li>Unverified claims pending fact-checking</li>
                <li>Content that could be misinterpreted without context</li>
              </ul>
            </SectionCard>

            <SectionCard id="enforcement" title="7) Enforcement & Penalties">
              <p>
                We apply actions based on severity, impact, and violation
                history.
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Violation level</th>
                      <th className="px-4 py-3 font-semibold">Examples</th>
                      <th className="px-4 py-3 font-semibold">Typical actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Low', 'Mild spam, minor harassment', 'Content removal, warning, temporary feature limits'],
                      ['Medium', 'Repeated bullying, harmful misinformation, deceptive ads', 'Content removal, strikes, temporary suspensions, demonetization'],
                      ['High', 'Hateful slurs, explicit sexual content, dangerous conspiracies', 'Immediate removal, multi-week suspension, ad/feature removal'],
                      ['Critical', 'Child safety violations, terrorist content, credible violent threats, egregious doxxing', 'Account termination, law-enforcement referral where required'],
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
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Strike system:</strong> repeated violations accumulate
                  strikes; certain severe violations can trigger one-strike
                  permanent bans.
                </li>
                <li>
                  <strong>Cross-account enforcement:</strong> related accounts
                  evading enforcement may also be actioned.
                </li>
                <li>
                  <strong>Business accounts:</strong> stricter thresholds may
                  apply.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="reporting-appeals" title="8) Reporting, Appeals & Transparency">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    8.1 Reporting
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Posts, profiles, messages, groups, or ads.</li>
                    <li>Include context and screenshots if safe to do so.</li>
                    <li>
                      For urgent risks or imminent harm, contact emergency
                      services first, then report to us.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    8.2 Appeals
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      If content is removed or account is restricted, we notify
                      you in-app and by email where possible.
                    </li>
                    <li>
                      Appeals with context and evidence.
                    </li>
                    <li>
                      Appeals are reviewed by trained moderators; complex cases
                      may receive escalated human review.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    8.3 Transparency
                  </h3>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      We publish periodic transparency reports on removals,
                      appeals outcomes, and government requests.
                    </li>
                    <li>
                      We improve classifier accuracy, reviewer guidance, and
                      fairness assessments continuously.
                    </li>
                  </ul>
                </div>
              </div>
            </SectionCard>

            <SectionCard id="safety-tools" title="9) Tools to Protect Yourself">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Privacy and safety settings to control who can view, comment,
                  message, or tag you.
                </li>
                <li>Block/Mute/Restrict to stop unwanted interactions.</li>
                <li>Keyword filters for comments or DMs.</li>
                <li>Enable multifactor authentication (MFA).</li>
              </ul>
            </SectionCard>

            <SectionCard id="synthetic-content" title="10) Media Integrity & Synthetic Content">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Disclose if audio, image, or video is AI-generated or
                  materially edited in a misleading way.
                </li>
                <li>
                  Prohibited: deceptive synthetic content that impersonates a
                  real person or fabricates harmful events.
                </li>
                <li>
                  We may label, downrank, or remove manipulated media depending
                  on harm.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="ads-promotions" title="11) Marketplace, Ads & Paid Promotions">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Paid content must follow Advertising &amp; Commerce Policies
                  and local laws.
                </li>
                <li>
                  Sponsored content must be disclosed using in-product tools.
                </li>
                <li>
                  No misleading claims (for example miracle cures or guaranteed
                  financial returns).
                </li>
                <li>
                  Financial services and political/civic ads face extra
                  verification and targeting limits.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="ip-detail" title="12) Intellectual Property">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Submit copyright takedown notices via our IP form.</li>
                <li>
                  We respond to counter-notifications where permitted by law.
                </li>
                <li>
                  Repeat IP infringement can lead to account restrictions or
                  termination.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="local-law" title="13) Local Law & Regional Sensitivities">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  When laws differ by region, we may geo-restrict content or
                  features to comply.
                </li>
                <li>
                  We consider context (newsworthiness, academic value) while
                  prioritizing safety and legal obligations.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="law-enforcement" title="14) Law Enforcement & Government Requests">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>We review legally valid requests for data or removal.</li>
                <li>
                  We push back on overbroad or unlawful requests and require due
                  legal process.
                </li>
                <li>
                  In emergencies involving imminent harm, we may disclose limited
                  information consistent with law.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="account-security" title="15) Account Security & Misuse">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Do not share your password or sell your account.</li>
                <li>
                  Never share credentials or MFA codes in response to phishing
                  or scams.
                </li>
                <li>
                  We may temporarily disable compromised accounts until ownership
                  is verified.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="education-help" title="16) Education, Resources & Help">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Help Center: tutorials on privacy controls, reporting, appeals,
                  and account recovery.
                </li>
                <li>
                  Safety resources: links to local hotlines and organizations.
                </li>
                <li>
                  Creators Hub: best practices for moderating live chats,
                  comments, and communities.
                </li>
              </ul>
            </SectionCard>

            <SectionCard id="changes" title="17) Changes to These Guidelines">
              <p>
                We may update these Guidelines to address new risks,
                technologies, or legal requirements.
              </p>
              <p>
                For material changes, we notify users in-app or by email and
                update the Last updated date.
              </p>
            </SectionCard>

          </article>
        </div>
      </div>
    </main>
  )
}

export default GuidelinesPage
