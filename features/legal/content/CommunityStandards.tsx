import Link from 'next/link'
import { LegalDocument } from '../LegalDocument'
import { POLICY_DATE } from '../policyLinks'

export function CommunityStandards() {
  return (
    <LegalDocument title="Community Standards" effective={POLICY_DATE} updated={POLICY_DATE}>
      <p>
        CribsTalk is a place to learn, mentor, and take part in community life. These standards
        explain what is not allowed, what needs extra care, and what happens when a rule is broken.
      </p>

      <section>
        <h2>1. Core principles</h2>
        <ul>
          <li>
            <strong>Safety first.</strong> Content or behavior that risks harm has no place here.
          </li>
          <li>
            <strong>Respect.</strong> Do not attack, exploit, or silence other people.
          </li>
          <li>
            <strong>Authenticity.</strong> Be who you say you are. Do not impersonate people or run spam.
          </li>
          <li>
            <strong>Care for younger people.</strong> Child safety rules are strict. Read the{' '}
            <Link href="/child-safety">Child Safety Policy</Link>.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. What is not allowed</h2>
        <h3>Child safety</h3>
        <p>
          Any content or behavior that sexualizes, exploits, grooms, or endangers a child is
          prohibited. We may report apparent child endangerment to the relevant authorities.
        </p>
        <h3>Sexual exploitation</h3>
        <p>
          Pornography, sexual solicitation, and sexual content shared without consent are
          prohibited.
        </p>
        <h3>Harassment and hate</h3>
        <p>
          Targeted insults, slurs, stalking, doxxing, and attacks based on who someone is are
          prohibited.
        </p>
        <h3>Violence and crime</h3>
        <p>
          Threats, praise of violent organizations, and instructions for crime, fraud, or illegal
          goods are prohibited.
        </p>
        <h3>Self-harm</h3>
        <p>
          Content that promotes or gives instructions for suicide or self-harm is prohibited.
          Personal recovery stories may stay up when they do not include instructions or graphic detail.
        </p>
        <h3>Misinformation that can cause harm</h3>
        <p>
          We may label or remove false claims that risk real-world harm, including deception about
          how to take part in a civic process.
        </p>
        <h3>Privacy and intellectual property</h3>
        <p>
          Do not share someone else’s personal or intimate information without consent. Do not post
          content you do not have rights to. See the <Link href="/copyright">Copyright Policy</Link>.
        </p>
        <h3>Impersonation, spam, and scams</h3>
        <p>
          Do not pretend to be another person or organization, buy or sell fake engagement, phish
          for credentials, or send repetitive unsolicited messages.
        </p>
      </section>

      <section>
        <h2>3. What needs extra care</h2>
        <p>
          Educational or newsworthy discussion of a sensitive topic may stay up when the context is
          clear and the content does not glorify harm. Graphic material should be labeled and should
          not use a shocking preview. Health claims should rely on credible sources.
        </p>
      </section>

      <section>
        <h2>4. Younger users</h2>
        <ul>
          <li>You must meet the minimum age required where you live.</li>
          <li>Do not ask a minor for private contact details or move a conversation off-platform to avoid safety tools.</li>
          <li>Features for younger accounts may be more limited.</li>
          <li>
            Parents can use the <Link href="/parents">parent resources</Link>.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Communities, mentors, and sellers</h2>
        <p>
          Community admins, mentors, and marketplace sellers are responsible for the spaces and
          listings they run. Follow the <Link href="/mentor-guidelines">mentorship guidelines</Link>,{' '}
          <Link href="/marketplace-policy">Marketplace Policy</Link>, and{' '}
          <Link href="/tradehub-policy">TradeHub Policy</Link>.
        </p>
      </section>

      <section>
        <h2>6. Enforcement</h2>
        <p>What we do depends on the harm and whether it has happened before.</p>
        <ul>
          <li>
            <strong>Lower severity.</strong> A warning, removal of the content, or a temporary limit.
          </li>
          <li>
            <strong>Repeated or more serious harm.</strong> Strikes, a suspension, or loss of selling or mentorship features.
          </li>
          <li>
            <strong>Severe harm.</strong> Account closure, and a report to authorities where the law requires it. Child safety violations are in this group.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Reporting and appeals</h2>
        <p>
          Use the report option on a post, profile, message, group, or listing, or go to{' '}
          <Link href="/report">Report a concern</Link>. If we act on your content or account, you
          can ask for another look at the <Link href="/appeals">Appeals Center</Link>.
        </p>
        <p>If someone is in immediate danger, contact local emergency services first.</p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          We may update these standards. For a significant change, we will give notice on the
          platform or by email.
        </p>
      </section>
    </LegalDocument>
  )
}
