import Link from 'next/link'
import { LegalDocument } from '../LegalDocument'
import { POLICY_DATE } from '../policyLinks'

function Page({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <LegalDocument title={title} updated={POLICY_DATE}>
      {children}
    </LegalDocument>
  )
}

export function CookiePolicy() {
  return (
    <Page title="Cookie Policy">
      <p>
        This page explains the cookies and similar storage CribsTalk uses on the web. It sits
        alongside the <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <section>
        <h2>1. Essential cookies</h2>
        <p>
          We use cookies and similar storage to keep you signed in, hold your session, remember
          preferences such as theme, and protect accounts against abuse. The platform does not work
          properly if these are blocked.
        </p>
      </section>
      <section>
        <h2>2. Advertising</h2>
        <p>
          We do not sell personal information. If we use cookies for personalized advertising, we
          will ask for consent where the law requires it. You can read more in the Privacy Policy.
        </p>
      </section>
      <section>
        <h2>3. Your choices</h2>
        <p>
          You can control cookies in your browser. Blocking essential cookies will break sign-in.
          Account privacy choices are in <Link href="/profile?tab=privacy">Privacy settings</Link>.
        </p>
      </section>
      <section>
        <h2>4. Contact</h2>
        <p>
          Questions: <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a>
        </p>
      </section>
    </Page>
  )
}

export function CopyrightPolicy() {
  return (
    <Page title="Copyright Policy">
      <p>
        Post only content you created or have permission to share. CribsTalk removes content that
        infringes copyright or trademark when we receive a valid notice, and repeat infringement
        can lead to account limits or closure.
      </p>
      <section>
        <h2>Send a notice</h2>
        <p>Email <a href="mailto:support@cribstalk.com">support@cribstalk.com</a> with:</p>
        <ul>
          <li>Your name and contact details</li>
          <li>A description of the work you own</li>
          <li>The CribsTalk URL of the material</li>
          <li>A statement that you have a good-faith belief the use is not authorized</li>
          <li>A statement that the notice is accurate</li>
        </ul>
        <p>
          If we remove material and the law allows a counter-notice, we will tell the person who
          posted it how to respond.
        </p>
      </section>
    </Page>
  )
}

export function DeleteAccountPage() {
  return (
    <Page title="Delete your account">
      <p>You can delete your CribsTalk account yourself. You do not have to install anything extra.</p>
      <section>
        <h2>On the web or in the app</h2>
        <ol>
          <li>Sign in.</li>
          <li>
            Open <Link href="/settings?tab=security">Settings → Security</Link>.
          </li>
          <li>Choose Delete account and confirm.</li>
        </ol>
        <p>
          Download a copy first if you want one:{' '}
          <Link href="/privacy/export-data">Download my information</Link>.
        </p>
      </section>
      <section>
        <h2>What happens</h2>
        <ul>
          <li>Public content may be removed</li>
          <li>Your profile may be anonymized</li>
          <li>Sign-in to that account ends</li>
          <li>Some records stay only when the law, a safety investigation, or a dispute requires it</li>
        </ul>
      </section>
      <section>
        <h2>Ask us to delete it</h2>
        <p>
          Email <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> from
          the address on the account. Use the subject “Delete my account”.
        </p>
        <p>
          If you still have access and cannot sign in, see <Link href="/account-recovery">account recovery</Link>.
        </p>
      </section>
    </Page>
  )
}

export function AccountRecoveryPage() {
  return (
    <Page title="Account recovery">
      <p>If you still have an account and cannot sign in, use the password reset on the sign-in page.</p>
      <ul>
        <li>
          <Link href="/forgot-password">Reset your password</Link>
        </li>
        <li>
          Email <a href="mailto:support@cribstalk.com">support@cribstalk.com</a> with your username and the email on the account
        </li>
      </ul>
      <p>
        Deleting an account ends sign-in. A deleted account is not guaranteed to be restored. If
        you deleted an account by mistake, email support and we will tell you whether anything can
        still be recovered.
      </p>
    </Page>
  )
}

export function ContactPage() {
  return (
    <Page title="Contact us">
      <p>CribsTalk is operated by Allora Digital Group LLC, New York, United States.</p>
      <ul>
        <li>
          General support: <a href="mailto:support@cribstalk.com">support@cribstalk.com</a>
        </li>
        <li>
          Privacy requests: <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a>
        </li>
        <li>
          Child safety: <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a>
        </li>
        <li>
          Media: <a href="mailto:media@cribstalk.com">media@cribstalk.com</a>
        </li>
        <li>
          Partnerships: <a href="mailto:partnerships@cribstalk.com">partnerships@cribstalk.com</a>
        </li>
        <li>
          Sister cities: <a href="mailto:sistercities@cribstalk.com">sistercities@cribstalk.com</a>
        </li>
        <li>
          Mentorship: <a href="mailto:mentors@cribstalk.com">mentors@cribstalk.com</a>
        </li>
        <li>
          Phone: <a href="tel:+233534787731">+233 534 787 731</a>
        </li>
        <li>
          Phone: <a href="tel:+19144337155">+1 914 433 7155</a>
        </li>
      </ul>
      <p>
        For product feedback, use the <Link href="/feedback">feedback page</Link>. For help with
        common tasks, visit the <Link href="/help">Help Center</Link>.
      </p>
    </Page>
  )
}

export function HelpCenterPage() {
  return (
    <Page title="Help Center">
      <section>
        <h2>Accounts</h2>
        <p>
          Create an account from Join on the home page. Reset a password from{' '}
          <Link href="/forgot-password">Forgot your password</Link>. Close an account from{' '}
          <Link href="/delete-account">Delete your account</Link>.
        </p>
      </section>
      <section>
        <h2>Privacy and safety</h2>
        <ul>
          <li>
            <Link href="/profile?tab=privacy">Privacy settings</Link>
          </li>
          <li>
            <Link href="/report">Report a concern</Link>
          </li>
          <li>
            <Link href="/appeals">Appeal a decision</Link>
          </li>
          <li>
            <Link href="/safety">Safety Center</Link>
          </li>
        </ul>
      </section>
      <section>
        <h2>Common questions</h2>
        <h3>How do I report a post?</h3>
        <p>Open the post menu and choose Report. You can also use the report page.</p>
        <h3>How do I change who can see my profile?</h3>
        <p>Open Privacy settings and update profile, post, comment, and message controls.</p>
        <h3>Who do I email?</h3>
        <p>
          Start with <a href="mailto:support@cribstalk.com">support@cribstalk.com</a> or the{' '}
          <Link href="/contact">contact page</Link>.
        </p>
      </section>
    </Page>
  )
}

export function ReportPage() {
  return (
    <Page title="Report a concern">
      <p>
        Use this page to report abuse, harassment, scams, or a safety issue on CribsTalk. If
        someone is in immediate danger, contact local emergency services first, then the{' '}
        <Link href="/emergency-report">emergency safety contact</Link>.
      </p>
      <section>
        <h2>In the product</h2>
        <p>
          On a post, profile, message, group, or marketplace listing, open the menu and choose
          Report. Include what happened. A screenshot helps when it is safe to share one.
        </p>
      </section>
      <section>
        <h2>By email</h2>
        <ul>
          <li>
            Safety: <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a>
          </li>
          <li>
            Child safety: use the <Link href="/child-safety">Child Safety Policy</Link> reporting links
          </li>
          <li>
            Marketplace: <Link href="/marketplace/report">Report a listing</Link>
          </li>
        </ul>
      </section>
    </Page>
  )
}

export function EmergencyReportPage() {
  return (
    <Page title="Emergency safety contact">
      <p>
        CribsTalk is not an emergency service. If you or someone else is in immediate danger,
        contact your local emergency number first.
      </p>
      <p>
        After that, email <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a> with the
        username, link, and what is happening, or use <Link href="/report">Report a concern</Link>.
        Child exploitation reports should also go through the{' '}
        <Link href="/child-safety">Child Safety Center</Link>.
      </p>
    </Page>
  )
}

export function SafetyCenterPage() {
  return (
    <Page title="Safety Center">
      <p>
        The Safety Center collects the tools and policies for reporting harm, protecting younger
        people, and securing your account.
      </p>
      <ul>
        <li>
          <Link href="/report">Report a concern</Link>
        </li>
        <li>
          <Link href="/safety/report">Safety reporting portal</Link>
        </li>
        <li>
          <Link href="/child-safety">Child Safety Policy</Link>
        </li>
        <li>
          <Link href="/youth-safety">Youth safety</Link>
        </li>
        <li>
          <Link href="/parents">Parents and guardians</Link>
        </li>
        <li>
          <Link href="/emergency-report">Emergency safety contact</Link>
        </li>
        <li>
          <Link href="/community-standards">Community Standards</Link>
        </li>
        <li>
          <Link href="/security">Security Center</Link>
        </li>
        <li>
          <Link href="/profile?tab=privacy">Privacy settings</Link>
        </li>
      </ul>
    </Page>
  )
}

export function SafetyReportPage() {
  return (
    <Page title="Safety reporting portal">
      <p>
        Send safety reports to <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a>, or
        use Report on the content itself. Tell us the link, the username, and what happened.
      </p>
      <p>
        For a child safety report, follow the <Link href="/child-safety">Child Safety Policy</Link>.
        For an emergency, start at <Link href="/emergency-report">emergency safety contact</Link>.
      </p>
    </Page>
  )
}

export function AppealsPage() {
  return (
    <Page title="Appeals Center">
      <p>
        If CribsTalk removed your content or limited your account, you can ask for a review. Send
        the account name, the content or decision, and why you believe it should change.
      </p>
      <ul>
        <li>
          <Link href="/appeals/community">Appeal a community standards decision</Link>
        </li>
        <li>
          <Link href="/appeals/account">Appeal an account suspension</Link>
        </li>
        <li>
          Email <a href="mailto:support@cribstalk.com">support@cribstalk.com</a>
        </li>
      </ul>
      <p>A person reviews appeals. Misuse of the appeals process can itself lead to limits.</p>
    </Page>
  )
}

export function CommunityAppealPage() {
  return (
    <Page title="Community standards appeals">
      <p>
        Email <a href="mailto:support@cribstalk.com">support@cribstalk.com</a> with the subject
        “Community standards appeal”. Include the link to the content, the date you were notified,
        and the context you want the reviewer to see.
      </p>
      <p>
        Read the <Link href="/community-standards">Community Standards</Link> before you write, so
        your note addresses the rule that was applied.
      </p>
    </Page>
  )
}

export function AccountAppealPage() {
  return (
    <Page title="Account suspension appeals">
      <p>
        Email <a href="mailto:support@cribstalk.com">support@cribstalk.com</a> with the subject
        “Account appeal”. Include the username, the email on the account, and why you believe the
        suspension should change.
      </p>
      <p>
        Child safety closures and some severe violations are not restored. We will tell you if a
        decision cannot be appealed.
      </p>
    </Page>
  )
}

export function ParentsPage() {
  return (
    <Page title="Parent resources">
      <p>
        Parents and guardians can ask CribsTalk to review a young person’s information, delete an
        account, or look into a safety concern.
      </p>
      <ul>
        <li>
          <Link href="/parents/safety">Parental safety guide</Link>
        </li>
        <li>
          <Link href="/parents/report">Parent reporting center</Link>
        </li>
        <li>
          <Link href="/child-safety">Child Safety Policy</Link>
        </li>
        <li>
          Privacy requests: <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a>
        </li>
        <li>
          Safety: <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a>
        </li>
      </ul>
    </Page>
  )
}

export function ParentalSafetyPage() {
  return (
    <Page title="Parental safety guide">
      <p>A few practical steps if a young person uses CribsTalk:</p>
      <ul>
        <li>Confirm they meet the minimum age where you live, and that any required consent is in place.</li>
        <li>Review privacy settings with them, including who can message or comment.</li>
        <li>Show them how to block and how to report.</li>
        <li>Talk about not moving conversations with strangers off the platform.</li>
        <li>
          Use the <Link href="/parents/report">parent reporting center</Link> if something feels wrong.
        </li>
      </ul>
    </Page>
  )
}

export function ParentReportPage() {
  return (
    <Page title="Parent reporting center">
      <p>
        Email <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a> from a parent or
        guardian. Include your name, your relationship to the child, the child’s username if you
        know it, and what you want us to do — review, delete, or investigate.
      </p>
      <p>
        For a privacy deletion request, you can also email{' '}
        <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a>.
      </p>
    </Page>
  )
}

export function YouthSafetyPage() {
  return (
    <Page title="Youth safety">
      <p>
        CribsTalk adds extra protections for younger users: tighter visibility, reporting and
        blocking tools, moderation, and checks before someone is shown as a verified mentor.
      </p>
      <p>
        The full rules are in the <Link href="/child-safety">Child Safety Policy</Link> and the{' '}
        <Link href="/community-standards">Community Standards</Link>. To report a problem, use{' '}
        <Link href="/report">Report a concern</Link>.
      </p>
    </Page>
  )
}
