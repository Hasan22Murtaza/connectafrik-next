import Link from 'next/link'
import { LegalDocument } from '../LegalDocument'
import { POLICY_DATE } from '../policyLinks'

export function PrivacyPolicy() {
  return (
    <LegalDocument title="Privacy Policy" effective={POLICY_DATE} updated={POLICY_DATE}>
      <p>
        CribsTalk is operated by Allora Digital Group LLC, a limited liability company formed in
        the State of New York, United States.
      </p>
      <p>
        CribsTalk is a global social learning, mentorship, communication, community engagement, and
        youth empowerment platform designed to connect young people, adults, educators, mentors,
        families, organizations, businesses, and communities worldwide.
      </p>
      <p>This Privacy Policy explains:</p>
      <ul>
        <li>What information we collect</li>
        <li>Why we collect it</li>
        <li>How we use and protect it</li>
        <li>When we share it</li>
        <li>Your rights and choices</li>
        <li>Our commitment to child and youth safety</li>
      </ul>
      <p>
        Website: <Link href="/">cribstalk.com</Link>
        <br />
        <Link href="/terms">Terms of Service</Link>
        {' · '}
        <Link href="/community-standards">Community Standards</Link>
        {' · '}
        <Link href="/safety">Safety Center</Link>
        {' · '}
        <Link href="/cookie-policy">Cookie Policy</Link>
      </p>

      <section id="information-you-provide">
        <h2>1. Information You Provide</h2>
        <h3>Account information</h3>
        <p>When creating a CribsTalk account, you may provide:</p>
        <ul>
          <li>Email address</li>
          <li>Password</li>
          <li>Username</li>
          <li>Display name</li>
          <li>Profile photograph</li>
          <li>Biography</li>
          <li>City and country</li>
          <li>Language preferences</li>
          <li>Interests and skills</li>
          <li>Social links (optional)</li>
        </ul>

        <h3>Educational and mentorship information</h3>
        <p>CribsTalk offers educational and mentorship services. You may voluntarily provide:</p>
        <ul>
          <li>Career interests</li>
          <li>Educational goals</li>
          <li>School, college, or university information</li>
          <li>Areas of expertise</li>
          <li>Professional qualifications</li>
          <li>Mentor or mentee preferences</li>
          <li>Skills and achievements</li>
          <li>Volunteer experience</li>
        </ul>
        <p>Providing this information is optional.</p>

        <h3>Content you create</h3>
        <p>You may create or upload:</p>
        <ul>
          <li>Posts, videos, photos, and articles</li>
          <li>Community updates, comments, and group discussions</li>
          <li>Messages, voice notes, and event content</li>
          <li>Learning materials</li>
          <li>Marketplace listings and TradeHub content</li>
          <li>Global Sister Cities Hub content</li>
          <li>Business networking content</li>
        </ul>
        <p>Some content is public depending on your privacy settings.</p>

        <h3>Communications</h3>
        <p>We collect information when you:</p>
        <ul>
          <li>Contact support</li>
          <li>Report abuse</li>
          <li>Appeal moderation decisions</li>
          <li>Participate in surveys</li>
          <li>Submit feedback</li>
          <li>Contact a mentor or community administrator</li>
        </ul>
      </section>

      <section id="youth-safety">
        <h2>2. Youth Safety and Child Protection</h2>
        <p>Youth safety is a core principle of CribsTalk.</p>
        <p>CribsTalk implements additional safeguards for younger users, including:</p>
        <ul>
          <li>Age-appropriate experiences</li>
          <li>Enhanced moderation</li>
          <li>Anti-bullying protections</li>
          <li>Safety screening</li>
          <li>Parent and guardian reporting channels</li>
          <li>Community safety teams</li>
          <li>Restricted visibility controls</li>
          <li>Mentor verification procedures</li>
          <li>Reporting and blocking tools</li>
        </ul>
        <p>
          Users under applicable minimum age requirements may require parental consent depending on
          their country of residence.
        </p>
        <p>CribsTalk prohibits:</p>
        <ul>
          <li>Child exploitation</li>
          <li>Grooming behavior</li>
          <li>Harassment</li>
          <li>Hate speech</li>
          <li>Violence promotion</li>
          <li>Illegal activities</li>
          <li>Sexual exploitation content</li>
        </ul>
        <p>
          Violations may result in immediate account suspension and referral to relevant authorities
          where required.
        </p>
        <ul>
          <li>
            <Link href="/report">Report abuse</Link>
          </li>
          <li>
            <Link href="/child-safety">Child Safety Center</Link>
          </li>
          <li>
            <Link href="/safety/report">Safety reporting portal</Link>
          </li>
          <li>
            <Link href="/emergency-report">Emergency safety contact</Link>
          </li>
          <li>
            <Link href="/safety">Community Safety Center</Link>
          </li>
        </ul>
      </section>

      <section id="permissions">
        <h2>3. Camera, Microphone, and Device Permissions</h2>
        <p>CribsTalk requests access only when you choose to use a feature that needs it.</p>
        <h3>Camera</h3>
        <p>Used for profile photos, video creation, live broadcasting, educational sessions, mentor meetings, and video calls.</p>
        <h3>Microphone</h3>
        <p>Used for voice calls, video calls, live discussions, and voice messages.</p>
        <h3>Location</h3>
        <p>Used only when you choose to share location, use local networking, community events, local opportunities, or emergency safety reporting. You can turn location access off at any time in your device settings.</p>
      </section>

      <section id="messaging">
        <h2>4. Messaging, Calls, and Encryption</h2>
        <h3>Private messaging</h3>
        <p>CribsTalk supports private messaging and group messaging. Messages may include text, photos, videos, documents, and voice notes.</p>
        <h3>Voice and video calls</h3>
        <p>CribsTalk supports one-to-one calls, group calls, mentorship sessions, educational consultations, and community meetings. Call content is not recorded unless you actively choose a recording feature where one is available.</p>
        <h3>End-to-end encryption</h3>
        <p>Where supported by current platform versions:</p>
        <ul>
          <li>Messages are encrypted</li>
          <li>Voice calls are encrypted</li>
          <li>Video calls are encrypted</li>
          <li>Shared files are encrypted</li>
        </ul>
        <p>Only intended recipients can access encrypted content.</p>
      </section>

      <section id="mentorship">
        <h2>5. Global Mentorship Program</h2>
        <p>
          CribsTalk provides a Global Mentorship Network connecting youth and adults with qualified
          mentors worldwide. To maintain trust and safety, verified mentors may voluntarily submit
          professional qualifications, certifications, government identification, background
          verification documents where permitted by law, and employment information.
        </p>
        <p>
          Verification information is used solely to confirm mentor status and is not publicly
          disclosed, except for approved verification badges.
        </p>
        <ul>
          <li>
            <Link href="/mentor-verification">Mentor Verification Program</Link>
          </li>
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

      <section id="sister-cities">
        <h2>6. Global Sister Cities Hub</h2>
        <p>
          CribsTalk includes the Global Sister Cities Hub, which promotes international collaboration
          among cities and communities. Participants may share economic development initiatives,
          environmental projects, tourism opportunities, educational exchanges, cultural programs,
          innovation partnerships, and municipal collaboration projects.
        </p>
        <p>Publicly shared partnership content may be visible to users worldwide.</p>
        <ul>
          <li>
            <Link href="/sister-cities">Global Sister Cities Hub</Link>
          </li>
          <li>
            <Link href="/sister-cities/register">Register a city</Link>
          </li>
          <li>
            <Link href="/sister-cities/apply">Apply for partnership</Link>
          </li>
          <li>
            <Link href="/sister-cities/partnerships">Partnership requests</Link>
          </li>
          <li>
            <Link href="/sister-cities/economic-development">Economic collaboration</Link>
          </li>
        </ul>
        <h3>TradeHub and Marketplace</h3>
        <ul>
          <li>
            <Link href="/tradehub-policy">TradeHub terms</Link>
          </li>
          <li>
            <Link href="/marketplace-policy">Marketplace Policy</Link>
          </li>
          <li>
            <Link href="/marketplace/report">Report a marketplace violation</Link>
          </li>
          <li>
            <Link href="/marketplace-safety">Marketplace safety guidelines</Link>
          </li>
        </ul>
      </section>

      <section id="automatic">
        <h2>7. Information Collected Automatically</h2>
        <h3>Device information</h3>
        <ul>
          <li>Device type</li>
          <li>Operating system</li>
          <li>Browser information</li>
          <li>Screen resolution</li>
          <li>App version</li>
        </ul>
        <h3>Network information</h3>
        <ul>
          <li>IP address</li>
          <li>Approximate location, including country, region, and city</li>
          <li>Network provider</li>
        </ul>
        <h3>Activity information</h3>
        <ul>
          <li>Pages visited and features used</li>
          <li>Searches performed</li>
          <li>Videos watched</li>
          <li>Engagement metrics</li>
          <li>Community participation</li>
        </ul>
        <p>We use this information to improve security, recommendations, and platform performance.</p>
      </section>

      <section id="use">
        <h2>8. How We Use Information</h2>
        <p>We use information to:</p>
        <ul>
          <li>Create and manage accounts</li>
          <li>Provide messaging and communication services</li>
          <li>Support educational experiences</li>
          <li>Match mentors and mentees</li>
          <li>Deliver content recommendations</li>
          <li>Improve platform safety</li>
          <li>Prevent fraud and abuse</li>
          <li>Review reports</li>
          <li>Process transactions</li>
          <li>Personalize user experiences</li>
          <li>Support community engagement</li>
          <li>Operate TradeHub and Marketplace services</li>
          <li>Support Global Sister Cities initiatives</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section id="safety-screening">
        <h2>9. Safety Screening</h2>
        <p>CribsTalk uses automated technology to help:</p>
        <ul>
          <li>Detect harmful content</li>
          <li>Identify spam and scams</li>
          <li>Prevent child exploitation</li>
          <li>Reduce misinformation</li>
          <li>Detect bullying and harassment</li>
          <li>Enforce community standards</li>
        </ul>
        <p>Automated systems assist human reviewers. They do not make every moderation decision on their own.</p>
      </section>

      <section id="visibility">
        <h2>10. Content Visibility</h2>
        <p>Depending on your settings, content may be:</p>
        <h3>Public</h3>
        <p>Visible to anyone, including public posts, public videos, public profiles, marketplace listings, and community announcements.</p>
        <h3>Community only</h3>
        <p>Visible only to community members.</p>
        <h3>Private</h3>
        <p>Visible only to the people you send it to.</p>
        <p>Public content may be copied, shared, or archived by others.</p>
        <ul>
          <li>
            <Link href="/profile?tab=privacy">Privacy controls</Link>
          </li>
          <li>
            <Link href="/settings">Account settings</Link>
          </li>
          <li>
            <Link href="/settings/content">Content visibility settings</Link>
          </li>
          <li>
            <Link href="/settings/blocking">Blocked users</Link>
          </li>
        </ul>
      </section>

      <section id="sharing">
        <h2>11. How We Share Information</h2>
        <h3>Service providers</h3>
        <p>
          We share information with providers that support cloud hosting, authentication, security,
          notifications, payment processing, content delivery, video streaming, and safety
          moderation. These providers may process information only to provide services on our behalf.
        </p>
        <h3>Legal and safety purposes</h3>
        <p>We may disclose information to:</p>
        <ul>
          <li>Comply with laws</li>
          <li>Respond to lawful requests</li>
          <li>Investigate fraud</li>
          <li>Protect users</li>
          <li>Enforce platform policies</li>
          <li>Address child safety concerns</li>
        </ul>
        <h3>Business transactions</h3>
        <p>
          Information may transfer in connection with a merger, acquisition, investment, or
          reorganization, subject to applicable privacy laws.
        </p>
      </section>

      <section id="advertising">
        <h2>12. Advertising</h2>
        <p>CribsTalk may display sponsored content, educational promotions, public service announcements, and advertising.</p>
        <p>
          We do not sell personal information to advertisers. Where the law requires it, we will ask
          for consent before delivering personalized advertising.
        </p>
      </section>

      <section id="security">
        <h2>13. Security</h2>
        <p>CribsTalk uses security controls including:</p>
        <ul>
          <li>TLS encryption</li>
          <li>Encrypted communications, where supported</li>
          <li>Role-based access controls</li>
          <li>Account authentication</li>
          <li>Content moderation</li>
          <li>Account protection monitoring</li>
          <li>Fraud prevention</li>
          <li>Security auditing</li>
        </ul>
        <p>No system can guarantee absolute security. We continue to improve these safeguards.</p>
        <ul>
          <li>
            <Link href="/security">Security Center</Link>
          </li>
          <li>
            <Link href="/security/report">Report a security issue</Link>
          </li>
          <li>
            <Link href="/security/help">Security best practices</Link>
          </li>
          <li>
            <Link href="/security/disclosure">Responsible disclosure</Link>
          </li>
        </ul>
      </section>

      <section id="retention">
        <h2>14. Data Retention</h2>
        <p>We retain information:</p>
        <ul>
          <li>While your account remains active</li>
          <li>To provide the services</li>
          <li>To maintain safety</li>
          <li>To comply with legal obligations</li>
          <li>To investigate abuse and fraud</li>
        </ul>
        <p>Information is deleted or anonymized when it is no longer required.</p>
      </section>

      <section id="deletion">
        <h2>15. Account Deletion</h2>
        <p>You may delete your CribsTalk account at any time.</p>
        <p>
          <Link href="/delete-account">Delete your account</Link>
        </p>
        <p>After deletion:</p>
        <ul>
          <li>Public content may be removed from the platform</li>
          <li>Profile information may be anonymized</li>
          <li>Access to your account will end</li>
          <li>Certain records may remain where the law requires us to keep them</li>
        </ul>
        <p>
          Archived information is retained only for legitimate legal, security, or compliance
          purposes. You can <Link href="/privacy/export-data">download your data before deletion</Link>.
          If you still have access and need help signing in, see <Link href="/account-recovery">account recovery</Link>.
        </p>
      </section>

      <section id="rights">
        <h2>16. Your Rights</h2>
        <p>Depending on where you live, you may have the right to:</p>
        <ul>
          <li>Access your information</li>
          <li>Correct inaccurate information</li>
          <li>Delete information</li>
          <li>Export information</li>
          <li>Restrict processing</li>
          <li>Withdraw consent</li>
          <li>Object to certain processing</li>
        </ul>
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
            <Link href="/privacy-center">Privacy Request Center</Link>
          </li>
        </ul>
        <p>
          You can also email{' '}
          <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a>.
        </p>
      </section>

      <section id="children">
        <h2>17. Children&apos;s Privacy</h2>
        <p>
          CribsTalk does not knowingly collect personal information from children below the minimum
          legal age without appropriate consent.
        </p>
        <p>Parents and guardians may contact us to review information, request deletion, report a concern, or ask a safety question.</p>
        <ul>
          <li>
            <Link href="/parents">Parent resources</Link>
          </li>
          <li>
            <Link href="/parents/safety">Parental safety guide</Link>
          </li>
          <li>
            <Link href="/parents/report">Parent reporting center</Link>
          </li>
          <li>
            <Link href="/youth-safety">Youth safety information</Link>
          </li>
        </ul>
      </section>

      <section id="transfers">
        <h2>18. International Data Transfers</h2>
        <p>CribsTalk operates globally. Information may be processed in the United States, Canada, the European Union, the United Kingdom, and other countries where our service providers operate.</p>
        <p>Where the law requires it, we put appropriate safeguards in place for those transfers.</p>
      </section>

      <section id="changes">
        <h2>19. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. When a change is significant, we will give notice through the CribsTalk platform, by email, or with an in-app notification.</p>
        <p>The effective date at the top of this policy tells you which version you are reading.</p>
      </section>

      <section id="appeals">
        <h2>20. Appeals and Enforcement</h2>
        <p>
          If we remove content or restrict an account, you can ask for a review. Include the account
          or content involved and why you believe the decision should change.
        </p>
        <ul>
          <li>
            <Link href="/appeals">Appeals Center</Link>
          </li>
          <li>
            <Link href="/appeals/community">Community standards appeals</Link>
          </li>
          <li>
            <Link href="/appeals/account">Account suspension appeals</Link>
          </li>
        </ul>
      </section>

      <section id="contact">
        <h2>21. Contact Us</h2>
        <p>
          Allora Digital Group LLC
          <br />
          CribsTalk Privacy Team
          <br />
          New York, United States
        </p>
        <ul>
          <li>
            Privacy requests:{' '}
            <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a>
          </li>
          <li>
            General support: <a href="mailto:support@cribstalk.com">support@cribstalk.com</a>
          </li>
          <li>
            Child safety: <a href="mailto:safety@cribstalk.com">safety@cribstalk.com</a>
          </li>
          <li>
            Media: <a href="mailto:media@cribstalk.com">media@cribstalk.com</a>
          </li>
          <li>
            Business partnerships:{' '}
            <a href="mailto:partnerships@cribstalk.com">partnerships@cribstalk.com</a>
          </li>
          <li>
            Global Sister Cities:{' '}
            <a href="mailto:sistercities@cribstalk.com">sistercities@cribstalk.com</a>
          </li>
          <li>
            Mentorship: <a href="mailto:mentors@cribstalk.com">mentors@cribstalk.com</a>
          </li>
          <li>
            <Link href="/contact">Contact form</Link>
          </li>
          <li>
            <Link href="/help">Help Center</Link>
          </li>
          <li>
            <Link href="/safety">Safety Center</Link>
          </li>
        </ul>
      </section>

      <section id="infrastructure">
        <h2>22. Security and Infrastructure</h2>
        <h3>Network protection</h3>
        <p>CribsTalk uses network protection that includes DDoS mitigation, a web application firewall, TLS encryption, and bot protection.</p>
        <h3>Encrypted communications</h3>
        <p>Private communications use encryption designed to protect conversations, calls, and file sharing, where the current platform version supports it.</p>
        <h3>Database security</h3>
        <p>Access controls, monitoring, logging, and data segregation limit access to information a person is authorized to view.</p>
        <h3>Global delivery</h3>
        <p>CribsTalk content is delivered through distributed infrastructure so video, messaging, and calls can reach people worldwide.</p>
      </section>

      <section id="commitment">
        <h2>23. Safety Commitment</h2>
        <p>
          CribsTalk was built to be more than a social network. Our mission is to create a safe,
          educational, mentorship-driven global community where youth and adults can learn, connect,
          collaborate, trade, and build together.
        </p>
      </section>
    </LegalDocument>
  )
}
