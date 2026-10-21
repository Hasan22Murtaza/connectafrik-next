import type { ComponentType } from 'react'
import { ChildSafetyPolicy } from './content/ChildSafety'
import { CommunityStandards } from './content/CommunityStandards'
import {
  AccountAppealPage,
  AccountRecoveryPage,
  AppealsPage,
  CommunityAppealPage,
  ContactPage,
  CookiePolicy,
  CopyrightPolicy,
  DeleteAccountPage,
  EmergencyReportPage,
  HelpCenterPage,
  ParentalSafetyPage,
  ParentReportPage,
  ParentsPage,
  ReportPage,
  SafetyCenterPage,
  SafetyReportPage,
  YouthSafetyPage,
} from './content/InfoPages'
import { PrivacyPolicy } from './content/PrivacyPolicy'
import {
  BecomeMentorPage,
  CorrectDataPage,
  DeleteDataPage,
  DisclosurePage,
  EconomicDevelopmentPage,
  ExportDataPage,
  MarketplacePolicyPage,
  MarketplaceReportPage,
  MarketplaceSafetyPage,
  MentorGuidelinesPage,
  MentorsPage,
  MentorVerificationPage,
  PartnershipsPage,
  PrivacyCenterPage,
  RegisterCityPage,
  RequestDataPage,
  SecurityCenterPage,
  SecurityHelpPage,
  SecurityReportPage,
  SisterCitiesPage,
  SisterCityApplyPage,
  TradeHubPolicyPage,
} from './content/ProgramPages'
import { TermsOfService } from './content/TermsOfService'

export type LegalEntry = {
  title: string
  description: string
  Component: ComponentType
}

export const legalPages: Record<string, LegalEntry> = {
  privacy: {
    title: 'Privacy Policy',
    description: 'How CribsTalk collects, uses, shares, and protects personal information.',
    Component: PrivacyPolicy,
  },
  terms: {
    title: 'Terms of Service',
    description: 'The rules for using CribsTalk.',
    Component: TermsOfService,
  },
  'community-standards': {
    title: 'Community Standards',
    description: 'What is and is not allowed on CribsTalk.',
    Component: CommunityStandards,
  },
  'child-safety': {
    title: 'Child Safety Policy',
    description: 'How CribsTalk protects children and how to report harm.',
    Component: ChildSafetyPolicy,
  },
  'cookie-policy': {
    title: 'Cookie Policy',
    description: 'How CribsTalk uses cookies and similar storage.',
    Component: CookiePolicy,
  },
  copyright: {
    title: 'Copyright Policy',
    description: 'How to report copyright or trademark infringement on CribsTalk.',
    Component: CopyrightPolicy,
  },
  'delete-account': {
    title: 'Delete your account',
    description: 'How to delete a CribsTalk account.',
    Component: DeleteAccountPage,
  },
  'account-recovery': {
    title: 'Account recovery',
    description: 'How to get back into a CribsTalk account.',
    Component: AccountRecoveryPage,
  },
  contact: {
    title: 'Contact us',
    description: 'How to reach CribsTalk support, privacy, and safety teams.',
    Component: ContactPage,
  },
  help: {
    title: 'Help Center',
    description: 'Help with CribsTalk accounts, privacy, and safety.',
    Component: HelpCenterPage,
  },
  report: {
    title: 'Report a concern',
    description: 'Report abuse, harassment, or a safety issue on CribsTalk.',
    Component: ReportPage,
  },
  'emergency-report': {
    title: 'Emergency safety contact',
    description: 'What to do when someone is in immediate danger.',
    Component: EmergencyReportPage,
  },
  safety: {
    title: 'Safety Center',
    description: 'Safety tools, reporting, and policies for CribsTalk.',
    Component: SafetyCenterPage,
  },
  'safety/report': {
    title: 'Safety reporting portal',
    description: 'Send a safety report to CribsTalk.',
    Component: SafetyReportPage,
  },
  appeals: {
    title: 'Appeals Center',
    description: 'Ask CribsTalk to review a moderation decision.',
    Component: AppealsPage,
  },
  'appeals/community': {
    title: 'Community standards appeals',
    description: 'Appeal a community standards decision.',
    Component: CommunityAppealPage,
  },
  'appeals/account': {
    title: 'Account suspension appeals',
    description: 'Appeal an account suspension.',
    Component: AccountAppealPage,
  },
  parents: {
    title: 'Parent resources',
    description: 'Resources for parents and guardians on CribsTalk.',
    Component: ParentsPage,
  },
  'parents/safety': {
    title: 'Parental safety guide',
    description: 'A short safety guide for parents and guardians.',
    Component: ParentalSafetyPage,
  },
  'parents/report': {
    title: 'Parent reporting center',
    description: 'How a parent or guardian can report a concern.',
    Component: ParentReportPage,
  },
  'youth-safety': {
    title: 'Youth safety',
    description: 'How CribsTalk approaches youth safety.',
    Component: YouthSafetyPage,
  },
  'mentor-verification': {
    title: 'Mentor Verification Policy',
    description: 'How mentor verification works on CribsTalk.',
    Component: MentorVerificationPage,
  },
  'become-a-mentor': {
    title: 'Become a mentor',
    description: 'Apply to mentor on CribsTalk.',
    Component: BecomeMentorPage,
  },
  mentors: {
    title: 'Find a mentor',
    description: 'How mentorship works on CribsTalk.',
    Component: MentorsPage,
  },
  'mentor-guidelines': {
    title: 'Mentorship guidelines',
    description: 'Rules for mentors and mentees on CribsTalk.',
    Component: MentorGuidelinesPage,
  },
  'sister-cities': {
    title: 'Global Sister Cities Hub',
    description: 'International community collaboration on CribsTalk.',
    Component: SisterCitiesPage,
  },
  'sister-cities/register': {
    title: 'Register a city',
    description: 'Register a city or community on the Sister Cities Hub.',
    Component: RegisterCityPage,
  },
  'sister-cities/apply': {
    title: 'Apply for a partnership',
    description: 'Apply for a sister-city partnership.',
    Component: SisterCityApplyPage,
  },
  'sister-cities/partnerships': {
    title: 'Partnership requests',
    description: 'Propose a collaboration with CribsTalk.',
    Component: PartnershipsPage,
  },
  'sister-cities/economic-development': {
    title: 'Economic collaboration',
    description: 'Economic development and trade collaboration on CribsTalk.',
    Component: EconomicDevelopmentPage,
  },
  'marketplace-policy': {
    title: 'Marketplace Policy',
    description: 'Rules for buying and selling on the CribsTalk marketplace.',
    Component: MarketplacePolicyPage,
  },
  'marketplace-safety': {
    title: 'Marketplace safety',
    description: 'How to stay safer when using the CribsTalk marketplace.',
    Component: MarketplaceSafetyPage,
  },
  'tradehub-policy': {
    title: 'TradeHub Policy',
    description: 'Rules for TradeHub posts and offers.',
    Component: TradeHubPolicyPage,
  },
  security: {
    title: 'Security Center',
    description: 'Account security tools and how to report a problem.',
    Component: SecurityCenterPage,
  },
  'security/help': {
    title: 'Security best practices',
    description: 'Steps to keep a CribsTalk account safer.',
    Component: SecurityHelpPage,
  },
  'security/report': {
    title: 'Report a security issue',
    description: 'Tell CribsTalk about a security problem with your account.',
    Component: SecurityReportPage,
  },
  'security/disclosure': {
    title: 'Responsible disclosure',
    description: 'How to report a security weakness in CribsTalk.',
    Component: DisclosurePage,
  },
  'privacy-center': {
    title: 'Privacy Request Center',
    description: 'Ask for access, correction, export, or deletion of your information.',
    Component: PrivacyCenterPage,
  },
  'privacy/request-data': {
    title: 'Request my data',
    description: 'Ask CribsTalk for a copy of your personal information.',
    Component: RequestDataPage,
  },
  'privacy/export-data': {
    title: 'Download my information',
    description: 'Request an export of your CribsTalk information.',
    Component: ExportDataPage,
  },
  'privacy/correct-data': {
    title: 'Correct my information',
    description: 'Ask CribsTalk to correct personal information.',
    Component: CorrectDataPage,
  },
  'privacy/delete-data': {
    title: 'Delete my information',
    description: 'Ask CribsTalk to delete personal information.',
    Component: DeleteDataPage,
  },
}

export const marketplaceReportEntry: LegalEntry = {
  title: 'Report a marketplace violation',
  description: 'Report a CribsTalk marketplace listing.',
  Component: MarketplaceReportPage,
}

export function getLegalPage(slug: string): LegalEntry | null {
  return legalPages[slug] ?? null
}

export function legalPaths(): string[] {
  return [...Object.keys(legalPages).map((slug) => `/${slug}`), '/marketplace/report']
}
