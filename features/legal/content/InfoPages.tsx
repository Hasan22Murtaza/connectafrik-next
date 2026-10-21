import Link from 'next/link'
import { LegalDocument } from '../LegalDocument'
import { POLICY_DATE } from '../policyLinks'
import { DeleteAccountAction } from './DeleteAccountAction'

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

export function DeleteSomeDataPage() {
  return (
    <Page title="Delete some of your CribsTalk data">
      <p>
        CribsTalk is operated by Allora Digital Group LLC. You can delete these things yourself, at
        any time, without closing your account. To close the account and delete everything, go to{' '}
        <Link href="/delete-account">Delete your account</Link>.
      </p>
      <section>
        <h2>Messages</h2>
        <ul>
          <li>
            In the app, press and hold a message; on the website, open the message’s menu. Choose{' '}
            <strong>Delete for everyone</strong> to remove a message you sent for both sides. This
            is available for a limited time after you send it.
          </li>
          <li>
            <strong>Delete for me</strong> removes a message from your view only. The other person
            still has their copy.
          </li>
          <li>
            To remove a whole conversation from your view, open the chat’s menu and choose{' '}
            <strong>Clear chat</strong>.
          </li>
          <li>
            Group messages work the same way. A group admin can also delete a group from the group’s
            details, which removes the group and its messages for everyone.
          </li>
        </ul>
      </section>
      <section>
        <h2>Posts</h2>
        <p>
          Open the menu on a post you created and choose <strong>Delete</strong>. The post leaves
          CribsTalk feeds and your profile.
        </p>
      </section>
      <section>
        <h2>Stories</h2>
        <p>
          Open your story and choose <strong>Delete Story</strong>. Stories also disappear on their
          own after 24 hours.
        </p>
      </section>
      <section>
        <h2>Memories and comments</h2>
        <p>
          On a Memory you published, open the menu and choose <strong>Delete</strong>. To remove a
          comment you wrote on a post, Memory, or thread, open the comment menu and choose{' '}
          <strong>Delete</strong>.
        </p>
      </section>
      <section>
        <h2>Friends</h2>
        <p>
          To remove a friend, go to <Link href="/friends">Friends</Link> or their profile and choose{' '}
          <strong>Remove</strong>.
        </p>
      </section>
      <section>
        <h2>What happens to deleted data</h2>
        <ul>
          <li>
            Messages, stories, comments, and friend connections are deleted straight away from the
            product experience.
          </li>
          <li>
            A deleted post or Memory disappears from feeds, search, and your profile at once. Stored
            media files may be kept for a short period in case the content was deleted by mistake or
            is needed for a legal request, then permanently destroyed unless a specific legal
            requirement obliges us to keep it.
          </li>
          <li>
            Copies in our database backups can persist for a short time until they are overwritten in
            the normal backup cycle.
          </li>
        </ul>
      </section>
      <section>
        <h2>Anything else</h2>
        <p>
          To ask us to delete other data we hold about you, email{' '}
          <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> from
          the address on your account and tell us what you want deleted. The full detail is in our{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </Page>
  )
}

export function DeleteAccountPage() {
  return (
    <Page title="Delete your CribsTalk account">
      <p>
        CribsTalk is operated by Allora Digital Group LLC. Only want to delete some things, such as
        messages or posts, and keep your account? See{' '}
        <Link href="/privacy/delete-data">Delete my information</Link>.
      </p>
      <section>
        <h2>Delete it here</h2>
        <DeleteAccountAction />
      </section>
      <section>
        <h2>Or delete it in Settings</h2>
        <p>
          On the website or in the CribsTalk app, open{' '}
          <Link href="/settings?tab=security">Settings → Security</Link> and choose Delete account.
          That does exactly what this page does.
        </p>
        <p>
          If you still have access and cannot sign in, see{' '}
          <Link href="/account-recovery">account recovery</Link>.
        </p>
      </section>
      <section>
        <h2>What happens</h2>
        <ul>
          <li>
            Your posts and public content are removed from CribsTalk — from feeds, search, and your
            profile.
          </li>
          <li>
            Your profile is anonymized to “Deleted account”, and your picture, bio, and location are
            cleared. Your username is released.
          </li>
          <li>Sign-in to the account is permanently disabled, and you are signed out everywhere.</li>
          <li>
            Conversations, comments, and threads you took part in remain for the other people in
            them, attributed to “Deleted account”.
          </li>
        </ul>
      </section>
      <section>
        <h2>What we keep</h2>
        <p>
          Before the account is closed, an archived copy of your profile, your email address, and
          records of your uploads — with the stored media files — may be placed in a restricted
          store that ordinary CribsTalk systems and staff cannot use for everyday product work. We
          keep it for legal obligations, fraud and abuse investigations, and dispute resolution. It
          is never used to run the Platform, recommend content, or advertise.
        </p>
        <p>
          We keep it for 90 days. After that it is permanently erased, together with your stored
          media files and your sign-in details, unless a specific legal requirement (such as a court
          order or a preservation request from law enforcement) obliges us to keep part of it for
          longer.
        </p>
        <p>
          You can ask us to erase that archived copy too. Email{' '}
          <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> and we
          will erase it unless the law requires us to keep it — in which case we will tell you what
          we must keep and why.
        </p>
        <p>
          The full detail is in section 15 of our <Link href="/privacy">Privacy Policy</Link>.
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
