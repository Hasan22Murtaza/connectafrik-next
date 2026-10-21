import Link from 'next/link'
import { LegalDocument } from '../LegalDocument'
import { POLICY_DATE } from '../policyLinks'

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <LegalDocument title={title} updated={POLICY_DATE}>
      {children}
    </LegalDocument>
  )
}

export function MentorVerificationPage() {
  return (
    <Page title="Mentor Verification Policy">
      <p>
        A verification badge means CribsTalk has reviewed information the mentor chose to submit.
        It is not a guarantee of employment, licensing, or a particular outcome for a mentee.
      </p>
      <section>
        <h2>What a mentor may submit</h2>
        <ul>
          <li>Professional qualifications and certifications</li>
          <li>Employment information</li>
          <li>Government identification</li>
          <li>Background documents, where the law allows us to ask for them</li>
        </ul>
        <p>
          This information is used only to confirm mentor status. It is not shown on the public
          profile, other than the badge itself. See the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
      <section>
        <h2>Apply or browse</h2>
        <ul>
          <li>
            <Link href="/become-a-mentor">Become a mentor</Link>
          </li>
          <li>
            <Link href="/mentors">Find a mentor</Link>
          </li>
          <li>
            <Link href="/mentor-guidelines">Mentorship guidelines</Link>
          </li>
        </ul>
      </section>
    </Page>
  )
}

export function BecomeMentorPage() {
  return (
    <Page title="Become a mentor">
      <p>
        Email <a href="mailto:mentors@cribstalk.com">mentors@cribstalk.com</a> with your CribsTalk
        username, the subjects you can mentor, and a short description of your experience. We will
        tell you if we need qualifications or identity documents.
      </p>
      <p>
        Do not send identity documents until we ask for them. Read the{' '}
        <Link href="/mentor-verification">Mentor Verification Policy</Link> and the{' '}
        <Link href="/mentor-guidelines">mentorship guidelines</Link> first.
      </p>
    </Page>
  )
}

export function MentorsPage() {
  return (
    <Page title="Find a mentor">
      <p>
        Mentorship on CribsTalk connects learners with adults who have offered to help. Look for a
        verification badge, read the person’s profile, and keep early conversations on CribsTalk.
      </p>
      <p>
        To offer mentorship, <Link href="/become-a-mentor">apply to become a mentor</Link>. Questions:{' '}
        <a href="mailto:mentors@cribstalk.com">mentors@cribstalk.com</a>.
      </p>
    </Page>
  )
}

export function MentorGuidelinesPage() {
  return (
    <Page title="Mentorship guidelines">
      <ul>
        <li>Be clear about your experience. Do not claim a qualification you do not have.</li>
        <li>Keep sessions appropriate. Romantic or sexual contact with a mentee is prohibited.</li>
        <li>Do not request money, gifts, or passwords in exchange for help.</li>
        <li>Do not move a young person into a private channel to avoid CribsTalk’s safety tools.</li>
        <li>Follow the <Link href="/community-standards">Community Standards</Link> and <Link href="/child-safety">Child Safety Policy</Link>.</li>
      </ul>
      <p>
        Report a problem to <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a> or through{' '}
        <Link href="/report">Report a concern</Link>.
      </p>
    </Page>
  )
}

export function SisterCitiesPage() {
  return (
    <Page title="Global Sister Cities Hub">
      <p>
        The Global Sister Cities Hub is where cities and communities share collaboration: education,
        culture, environment, tourism, innovation, and economic development. Public partnership
        posts can be seen by people on CribsTalk worldwide.
      </p>
      <ul>
        <li>
          <Link href="/sister-cities/register">Register a city</Link>
        </li>
        <li>
          <Link href="/sister-cities/apply">Apply for a partnership</Link>
        </li>
        <li>
          <Link href="/sister-cities/partnerships">Partnership requests</Link>
        </li>
        <li>
          <Link href="/sister-cities/economic-development">Economic collaboration</Link>
        </li>
      </ul>
      <p>
        Email <a href="mailto:sistercities@cribstalk.com">sistercities@cribstalk.com</a>.
      </p>
    </Page>
  )
}

export function RegisterCityPage() {
  return (
    <Page title="Register a city">
      <p>
        Email <a href="mailto:sistercities@cribstalk.com">sistercities@cribstalk.com</a> with the
        city or community name, country, a short description, and the name and role of the person
        submitting it. We use this to confirm the listing before it is shown as a sister-city profile.
      </p>
    </Page>
  )
}

export function SisterCityApplyPage() {
  return (
    <Page title="Apply for a partnership">
      <p>
        Email <a href="mailto:sistercities@cribstalk.com">sistercities@cribstalk.com</a> with both
        communities, the kind of exchange you want (education, culture, environment, or another
        area), and who will be the contact. Public posts about a partnership follow the{' '}
        <Link href="/community-standards">Community Standards</Link>.
      </p>
    </Page>
  )
}

export function PartnershipsPage() {
  return (
    <Page title="Partnership requests">
      <p>
        Organizations and cities can propose a collaboration by emailing{' '}
        <a href="mailto:partnerships@cribstalk.com">partnerships@cribstalk.com</a> or{' '}
        <a href="mailto:sistercities@cribstalk.com">sistercities@cribstalk.com</a>. Include who you
        represent and what you want to do together.
      </p>
    </Page>
  )
}

export function EconomicDevelopmentPage() {
  return (
    <Page title="Economic collaboration">
      <p>
        The sister-cities area can be used to share economic development initiatives, trade
        interests, and innovation projects. Listings and offers must be honest and must follow the{' '}
        <Link href="/tradehub-policy">TradeHub Policy</Link> and{' '}
        <Link href="/marketplace-policy">Marketplace Policy</Link> when something is offered for sale.
      </p>
      <p>
        Contact <a href="mailto:sistercities@cribstalk.com">sistercities@cribstalk.com</a>.
      </p>
    </Page>
  )
}

export function MarketplacePolicyPage() {
  return (
    <Page title="Marketplace Policy">
      <p>
        The marketplace lets people list goods and services. Sellers are responsible for the
        accuracy of a listing, for following local law, and for completing what they offer.
      </p>
      <section>
        <h2>Not allowed</h2>
        <ul>
          <li>Illegal or counterfeit goods</li>
          <li>Misleading claims, including guaranteed income or miracle results</li>
          <li>Listings that hide who the seller is in order to scam buyers</li>
          <li>Anything prohibited by the <Link href="/community-standards">Community Standards</Link></li>
        </ul>
      </section>
      <section>
        <h2>Safety</h2>
        <p>
          Read the <Link href="/marketplace-safety">marketplace safety guidelines</Link>. Report a
          listing at <Link href="/marketplace/report">Report a marketplace violation</Link>.
        </p>
      </section>
    </Page>
  )
}

export function MarketplaceSafetyPage() {
  return (
    <Page title="Marketplace safety">
      <ul>
        <li>Keep payment and delivery arrangements inside the tools CribsTalk provides.</li>
        <li>Be wary of requests to pay off-platform or to share passwords and codes.</li>
        <li>Check the seller’s profile before you buy.</li>
        <li>
          Report a suspicious listing through <Link href="/marketplace/report">marketplace reports</Link>.
        </li>
      </ul>
    </Page>
  )
}

export function MarketplaceReportPage() {
  return (
    <Page title="Report a marketplace violation">
      <p>
        On the listing, use Report. You can also email{' '}
        <a href="mailto:support@cribstalk.com">support@cribstalk.com</a> with the listing link and
        what is wrong — for example a scam, a prohibited item, or a misleading description.
      </p>
      <p>
        Safety issues involving a young person should go to{' '}
        <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a>.
      </p>
    </Page>
  )
}

export function TradeHubPolicyPage() {
  return (
    <Page title="TradeHub Policy">
      <p>
        TradeHub is for business networking and trade-related posts. Offers must describe the real
        product, service, or opportunity. Do not post fake opportunities, hidden fees, or content
        that breaks the <Link href="/community-standards">Community Standards</Link>.
      </p>
      <p>
        Items offered for sale also follow the <Link href="/marketplace-policy">Marketplace Policy</Link>.
        Report a problem through <Link href="/report">Report a concern</Link>.
      </p>
    </Page>
  )
}

export function SecurityCenterPage() {
  return (
    <Page title="Security Center">
      <p>
        CribsTalk protects accounts with encrypted connections, access controls, monitoring, and
        moderation. You can help by using a unique password and by turning on the security options
        in <Link href="/settings?tab=security">Settings → Security</Link>.
      </p>
      <ul>
        <li>
          <Link href="/security/help">Security best practices</Link>
        </li>
        <li>
          <Link href="/security/report">Report a security issue</Link>
        </li>
        <li>
          <Link href="/security/disclosure">Responsible disclosure</Link>
        </li>
      </ul>
    </Page>
  )
}

export function SecurityHelpPage() {
  return (
    <Page title="Security best practices">
      <ul>
        <li>Use a password you do not use anywhere else.</li>
        <li>Do not share passwords or sign-in codes, including with someone who claims to be CribsTalk.</li>
        <li>Review devices in <Link href="/settings?tab=devices">Settings → Devices</Link>.</li>
        <li>Sign out of devices you do not recognize.</li>
        <li>
          If you think the account was taken over, email{' '}
          <a href="mailto:support@cribstalk.com">support@cribstalk.com</a> and see{' '}
          <Link href="/account-recovery">account recovery</Link>.
        </li>
      </ul>
    </Page>
  )
}

export function SecurityReportPage() {
  return (
    <Page title="Report a security issue">
      <p>
        Email <a href="mailto:support@cribstalk.com">support@cribstalk.com</a> with the subject
        “Security issue”. Describe what you saw, the page or account involved, and when it happened.
        Do not include your password.
      </p>
      <p>
        If you found a vulnerability in the product, use{' '}
        <Link href="/security/disclosure">responsible disclosure</Link> instead of posting it publicly.
      </p>
    </Page>
  )
}

export function DisclosurePage() {
  return (
    <Page title="Responsible disclosure">
      <p>
        If you believe you have found a security weakness in CribsTalk, email{' '}
        <a href="mailto:support@cribstalk.com">support@cribstalk.com</a> with the subject
        “Responsible disclosure”. Give us enough detail to reproduce the issue.
      </p>
      <p>
        Please give us a reasonable time to investigate before you describe the issue in public.
        Do not access other people’s data, disrupt the service, or demand payment. We will reply
        when we have reviewed the report.
      </p>
    </Page>
  )
}

export function PrivacyCenterPage() {
  return (
    <Page title="Privacy Request Center">
      <p>
        Use these links to ask for a copy of your information, a correction, or deletion. Email{' '}
        <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> from the
        address on your account. We may ask a short question to confirm the request is yours.
      </p>
      <ul>
        <li>
          <Link href="/privacy/request-data">Request my data</Link>
        </li>
        <li>
          <Link href="/privacy/export-data">Download my information</Link>
        </li>
        <li>
          <Link href="/privacy/correct-data">Correct my information</Link>
        </li>
        <li>
          <Link href="/privacy/delete-data">Delete my information</Link>
        </li>
        <li>
          <Link href="/delete-account">Delete your account</Link>
        </li>
        <li>
          <Link href="/privacy">Privacy Policy</Link>
        </li>
      </ul>
    </Page>
  )
}

export function RequestDataPage() {
  return (
    <Page title="Request my data">
      <p>
        Email <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> with
        the subject “Access request”. Tell us the username and the email on the account. We will
        confirm it is you and then provide the personal information the law requires us to share.
      </p>
    </Page>
  )
}

export function ExportDataPage() {
  return (
    <Page title="Download my information">
      <p>
        Email <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> with
        the subject “Export my data”, from the address on your account. We will send a copy of the
        information we can provide in a portable format.
      </p>
      <p>
        If you are about to close the account, do this before you use{' '}
        <Link href="/delete-account">Delete your account</Link>.
      </p>
    </Page>
  )
}

export function CorrectDataPage() {
  return (
    <Page title="Correct my information">
      <p>
        You can update your name, photo, bio, and privacy choices from your profile and{' '}
        <Link href="/profile?tab=privacy">Privacy settings</Link>.
      </p>
      <p>
        For something you cannot edit yourself, email{' '}
        <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> with the
        subject “Correction request” and tell us what is wrong.
      </p>
    </Page>
  )
}

export function DeleteDataPage() {
  return (
    <Page title="Delete my information">
      <p>
        To close the whole account, use <Link href="/delete-account">Delete your account</Link>.
      </p>
      <p>
        To ask us to delete specific information while keeping the account, email{' '}
        <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> with the
        subject “Delete my information”. Some records stay when the law, security, or an open
        dispute requires it. We will tell you if that applies.
      </p>
    </Page>
  )
}
