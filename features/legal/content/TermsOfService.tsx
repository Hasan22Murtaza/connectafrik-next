import Link from 'next/link'
import { LegalDocument } from '../LegalDocument'
import { POLICY_DATE } from '../policyLinks'

export function TermsOfService() {
  return (
    <LegalDocument title="Terms of Service" effective={POLICY_DATE} updated={POLICY_DATE}>
      <p>
        These terms govern your use of CribsTalk. CribsTalk is operated by Allora Digital Group LLC
        (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), a limited liability company formed in the
        State of New York, United States.
      </p>
      <p>
        By creating an account or using CribsTalk, you agree to these terms, our{' '}
        <Link href="/privacy">Privacy Policy</Link>, and our{' '}
        <Link href="/community-standards">Community Standards</Link>. If you do not agree, do not use
        the platform.
      </p>

      <section>
        <h2>1. The service</h2>
        <p>
          CribsTalk is a social learning, mentorship, communication, and community platform. It
          includes profiles, posts, messaging, calls, communities, mentorship, the marketplace,
          TradeHub, and the Global Sister Cities Hub.
        </p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          You must be at least 13 years old to create an account or use CribsTalk. If you are under
          18, you represent that you have your parent or legal guardian’s permission. We may close
          accounts that do not meet these requirements. Where local law sets a higher minimum age,
          that higher age applies.
        </p>
      </section>

      <section>
        <h2>3. Accounts</h2>
        <p>
          You are responsible for your account, for keeping your sign-in details private, and for
          activity that happens under your account. You agree to give accurate, current information
          and to keep it up to date. Notify us right away if you suspect unauthorized use of your
          account.
        </p>
      </section>

      <section>
        <h2>4. Your content</h2>
        <p>
          You keep ownership of the content you post. You give CribsTalk a worldwide, non-exclusive,
          royalty-free license to host, store, reproduce, display, and distribute that content so we
          can operate the platform — for example, to show a post to the people your settings allow.
        </p>
        <p>
          You are responsible for your content. Do not post anything that breaks the law, these
          terms, or someone else’s rights. See the <Link href="/copyright">Copyright Policy</Link>.
        </p>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Break applicable laws</li>
          <li>Exploit or endanger a child, or post child sexual abuse material</li>
          <li>Harass, threaten, or harm other people</li>
          <li>Post hate speech, or content that promotes violence or violent extremism</li>
          <li>Post content you do not have the right to share</li>
          <li>Impersonate another person or mislead people about who you are</li>
          <li>Send spam, malware, or phishing</li>
          <li>Interfere with the platform or try to access an account that is not yours</li>
        </ul>
        <p>
          The <Link href="/community-standards">Community Standards</Link> and{' '}
          <Link href="/child-safety">Child Safety Policy</Link> explain what is not allowed and how
          we enforce those rules.
        </p>
      </section>

      <section>
        <h2>6. Mentorship, marketplace, and sister cities</h2>
        <p>
          Mentorship, marketplace, TradeHub, and sister-city features have additional rules. Read
          the <Link href="/mentor-verification">Mentor Verification Policy</Link>,{' '}
          <Link href="/marketplace-policy">Marketplace Policy</Link>,{' '}
          <Link href="/tradehub-policy">TradeHub Policy</Link>, and{' '}
          <Link href="/sister-cities">Global Sister Cities Hub</Link> page before you use them.
        </p>
      </section>

      <section>
        <h2>7. Our intellectual property</h2>
        <p>
          The CribsTalk name, logo, design, and software are the intellectual property of Allora
          Digital Group LLC. You may not copy, modify, distribute, or reverse-engineer any part of
          the platform without our prior written consent, except as the law allows.
        </p>
      </section>

      <section>
        <h2>8. Enforcement</h2>
        <p>
          We may remove content, limit features, or suspend or close an account when we believe
          these terms or the Community Standards have been broken, or when we need to protect
          people or the platform. You can ask for a review through the{' '}
          <Link href="/appeals">Appeals Center</Link>. You may delete your account at any time
          through <Link href="/delete-account">Delete Account</Link> or by contacting support.
        </p>
      </section>

      <section>
        <h2>9. Disclaimer and limitation of liability</h2>
        <p>
          CribsTalk is provided &quot;as is&quot; and as available. We do not guarantee that the
          platform will be uninterrupted, error-free, or completely secure. Mentors, communities,
          and marketplace sellers are responsible for what they offer. CribsTalk does not guarantee
          a particular educational, business, or partnership outcome.
        </p>
        <p>
          To the maximum extent permitted by law, Allora Digital Group LLC is not liable for
          indirect, incidental, special, or consequential damages arising from your use of the
          platform, including loss of data, revenue, or profits.
        </p>
      </section>

      <section>
        <h2>10. Changes</h2>
        <p>
          We may update these terms. When a change is significant, we will give notice on the
          platform or by email. The date at the top tells you which version you are reading.
          Continued use of CribsTalk after changes are posted means you accept the updated terms.
        </p>
      </section>

      <section>
        <h2>11. Contact</h2>
        <p>
          Questions about these terms: <a href="mailto:support@cribstalk.com">support@cribstalk.com</a>
          {' '}or the <Link href="/contact">contact page</Link>.
        </p>
      </section>
    </LegalDocument>
  )
}
