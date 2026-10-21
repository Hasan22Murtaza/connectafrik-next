import Link from 'next/link'
import { LegalDocument } from '../LegalDocument'
import { POLICY_DATE } from '../policyLinks'

export function ChildSafetyPolicy() {
  return (
    <LegalDocument title="Child Safety Policy" effective={POLICY_DATE} updated={POLICY_DATE}>
      <p>
        Protecting children and young people is a core rule of CribsTalk, not an add-on. This
        policy explains what we prohibit, how to report it, and how parents can reach us.
      </p>

      <section>
        <h2>1. Who this covers</h2>
        <p>
          CribsTalk is not directed to children below the minimum age required where they live. We
          do not knowingly collect personal information from a child below that age without the
          consent the law requires.
        </p>
      </section>

      <section>
        <h2>2. What we prohibit</h2>
        <ul>
          <li>Child sexual exploitation and sexual content involving minors</li>
          <li>Grooming, solicitation, or attempts to move a child into a private or off-platform conversation for harm</li>
          <li>Bullying and harassment of a young person</li>
          <li>Content that promotes violence against a child</li>
          <li>Sharing a child’s personal information in a way that puts them at risk</li>
        </ul>
        <p>
          A violation can lead to immediate removal, account closure, and a referral to relevant
          authorities where the law requires it.
        </p>
      </section>

      <section>
        <h2>3. How we reduce risk</h2>
        <ul>
          <li>Age-appropriate limits and restricted visibility for younger accounts</li>
          <li>Reporting, blocking, and moderation tools</li>
          <li>Safety screening that assists human reviewers</li>
          <li>Mentor verification before a mentor badge is shown</li>
          <li>A parent and guardian reporting channel</li>
        </ul>
      </section>

      <section>
        <h2>4. How to report</h2>
        <p>If you believe a child is being exploited or harmed on CribsTalk:</p>
        <ul>
          <li>
            <Link href="/report">Report abuse</Link>
          </li>
          <li>
            <Link href="/safety/report">Safety reporting portal</Link>
          </li>
          <li>
            <Link href="/parents/report">Parent reporting center</Link>
          </li>
          <li>
            Email <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a>
          </li>
        </ul>
        <p>
          If someone is in immediate danger, contact local emergency services first, then use the{' '}
          <Link href="/emergency-report">emergency safety contact</Link> page.
        </p>
      </section>

      <section>
        <h2>5. Parents and guardians</h2>
        <p>You can ask us to review information, delete an account, or look into a safety concern.</p>
        <ul>
          <li>
            <Link href="/parents">Parent resources</Link>
          </li>
          <li>
            <Link href="/parents/safety">Parental safety guide</Link>
          </li>
          <li>
            Email <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> for a privacy request
          </li>
        </ul>
      </section>
    </LegalDocument>
  )
}
