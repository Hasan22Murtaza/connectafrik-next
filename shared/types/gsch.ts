export type GschOrgType =
  | 'municipality'
  | 'government_agency'
  | 'business'
  | 'startup'
  | 'investor'
  | 'chamber_of_commerce'
  | 'university'
  | 'ngo'
  | 'tourism_board'
  | 'citizen'

export type GschVerificationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'additional_info_required'
  | 'verified'
  | 'rejected'

export type GschVerificationBadge =
  | 'verified_city'
  | 'verified_business'
  | 'verified_institution'
  | 'verified_government'
  | 'strategic_global_partner'

export type GschOrgMemberRole = 'owner' | 'admin' | 'representative' | 'member'
export type GschOrgMemberStatus = 'active' | 'invited' | 'removed'

export const GSCH_ORG_TYPES: { value: GschOrgType; label: string }[] = [
  { value: 'municipality', label: 'Municipality' },
  { value: 'government_agency', label: 'Government agency' },
  { value: 'business', label: 'Business' },
  { value: 'startup', label: 'Startup' },
  { value: 'investor', label: 'Investor' },
  { value: 'chamber_of_commerce', label: 'Chamber of commerce' },
  { value: 'university', label: 'University' },
  { value: 'ngo', label: 'NGO' },
  { value: 'tourism_board', label: 'Tourism board' },
  { value: 'citizen', label: 'Citizen' },
]

export const GSCH_VERIFICATION_BADGES: {
  value: GschVerificationBadge
  label: string
}[] = [
  { value: 'verified_city', label: 'Verified city' },
  { value: 'verified_business', label: 'Verified business' },
  { value: 'verified_institution', label: 'Verified institution' },
  { value: 'verified_government', label: 'Verified government' },
  { value: 'strategic_global_partner', label: 'Strategic global partner' },
]

export const GSCH_CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
] as const

export type GschSubscriptionTier = 'free' | 'standard' | 'enterprise'

export const GSCH_SUBSCRIPTION_TIERS: {
  value: GschSubscriptionTier
  label: string
}[] = [
  { value: 'free', label: 'Free' },
  { value: 'standard', label: 'Standard' },
  { value: 'enterprise', label: 'Enterprise' },
]

export interface GschOrganization {
  id: string
  name: string
  org_type: GschOrgType
  country: string
  state_province: string | null
  city: string | null
  website: string | null
  official_email: string | null
  description: string | null
  logo_url: string | null
  areas_of_interest: string[]
  verification_status: GschVerificationStatus
  verification_badge: GschVerificationBadge | null
  subscription_tier?: GschSubscriptionTier
  subscription_notes?: string | null
  subscription_updated_at?: string | null
  subscription_updated_by?: string | null
  created_by: string
  verified_by: string | null
  verified_at: string | null
  rejection_reason: string | null
  additional_info_notes: string | null
  created_at: string
  updated_at: string
  my_role?: GschOrgMemberRole | null
}

export interface GschMembership {
  id: string
  organization_id: string
  user_id: string
  role: GschOrgMemberRole
  status: GschOrgMemberStatus
  created_at: string
  updated_at: string
  profile?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface GschVerification {
  id: string
  organization_id: string
  submitted_by: string
  status: GschVerificationStatus
  document_urls: string[]
  notes: string | null
  reviewer_id: string | null
  reviewed_at: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
  organization?: Pick<
    GschOrganization,
    | 'id'
    | 'name'
    | 'org_type'
    | 'country'
    | 'verification_status'
    | 'verification_badge'
    | 'logo_url'
  > | null
}

export interface GschCity {
  id: string
  organization_id: string | null
  name: string
  country: string
  continent: string | null
  state_province: string | null
  logo_url: string | null
  cover_image_url: string | null
  description: string | null
  population: number | null
  official_website: string | null
  mayor_name: string | null
  mayor_user_id: string | null
  economic_info: string | null
  major_industries: string[]
  tourism_assets: string[]
  education_institutions: string[]
  infrastructure_priorities: string[]
  investment_opportunities: string | null
  renewable_energy_initiatives: string | null
  climate_objectives: string | null
  export_products: string[]
  collaboration_interests: string[]
  existing_sister_cities: string[]
  latitude: number | null
  longitude: number | null
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
  is_followed?: boolean
  organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'verification_status' | 'verification_badge' | 'logo_url'
  > | null
  interests?: GschCityInterest[]
}

export interface GschCityInterest {
  id: string
  city_id: string
  interest_slug: string
  interest_label: string
  created_at: string
}

export interface GschCityFollow {
  id: string
  city_id: string
  user_id: string
  created_at: string
}

export interface GschAuditLog {
  id: string
  actor_id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface GschPaginated<T> {
  data: T[]
  page: number
  pageSize: number
  hasMore: boolean
}

export type GschPartnershipType =
  | 'sister_city'
  | 'economic'
  | 'tourism'
  | 'education'
  | 'climate'
  | 'infrastructure'
  | 'innovation'
  | 'cultural'
  | 'other'

export type GschPartnershipRequestStatus =
  | 'draft'
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'cancelled'

export type GschPartnershipStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export type GschOpportunityCategory =
  | 'investment'
  | 'grant'
  | 'conference'
  | 'trade_mission'
  | 'development_funding'
  | 'innovation_challenge'
  | 'sister_city'
  | 'education_program'
  | 'other'

export const GSCH_PARTNERSHIP_TYPES: { value: GschPartnershipType; label: string }[] = [
  { value: 'sister_city', label: 'Sister city' },
  { value: 'economic', label: 'Economic' },
  { value: 'tourism', label: 'Tourism' },
  { value: 'education', label: 'Education' },
  { value: 'climate', label: 'Climate' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'innovation', label: 'Innovation' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'other', label: 'Other' },
]

export const GSCH_OPPORTUNITY_CATEGORIES: {
  value: GschOpportunityCategory
  label: string
}[] = [
  { value: 'investment', label: 'Investment' },
  { value: 'grant', label: 'Grant' },
  { value: 'conference', label: 'Conference' },
  { value: 'trade_mission', label: 'Trade mission' },
  { value: 'development_funding', label: 'Development funding' },
  { value: 'innovation_challenge', label: 'Innovation challenge' },
  { value: 'sister_city', label: 'Sister city' },
  { value: 'education_program', label: 'Education program' },
  { value: 'other', label: 'Other' },
]

/** Transparent match weights (sum 100) — for UI disclosure. */
export const GSCH_MATCH_WEIGHTS_UI = {
  collaboration_interests: 25,
  major_industries: 20,
  infrastructure_priorities: 15,
  tourism_assets: 10,
  education_institutions: 10,
  climate_renewable: 10,
  export_products: 5,
  different_country: 5,
} as const

export type GschMatchScoreBreakdown = Record<
  string,
  { weight: number; overlap: number; score: number }
>

export interface GschPartnershipRequest {
  id: string
  requesting_organization_id: string
  target_organization_id: string | null
  requesting_city_id: string | null
  target_city_id: string | null
  title: string
  partnership_type: GschPartnershipType
  objectives: string | null
  proposed_duration: string | null
  message: string | null
  status: GschPartnershipRequestStatus
  created_by: string
  responded_by: string | null
  responded_at: string | null
  response_notes: string | null
  partnership_id: string | null
  created_at: string
  updated_at: string
  direction?: 'sent' | 'received'
  requesting_organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  target_organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  requesting_city?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
  target_city?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschPartnership {
  id: string
  request_id: string | null
  title: string
  partnership_type: GschPartnershipType
  organization_a_id: string
  organization_b_id: string
  city_a_id: string | null
  city_b_id: string | null
  objectives: string | null
  status: GschPartnershipStatus
  started_at: string
  ends_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  organization_a?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  organization_b?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  city_a?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
  city_b?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschMatchRecommendation {
  id: string
  source_city_id: string
  recommended_city_id: string
  compatibility_score: number
  shared_interests: string[]
  collaboration_areas: string[]
  score_breakdown: GschMatchScoreBreakdown
  explanation: string
  algorithm_version: string
  computed_at: string
  created_at: string
  source_city?: Pick<
    GschCity,
    'id' | 'name' | 'country' | 'continent' | 'logo_url' | 'population'
  > | null
  recommended_city?: Pick<
    GschCity,
    | 'id'
    | 'name'
    | 'country'
    | 'continent'
    | 'logo_url'
    | 'population'
    | 'major_industries'
    | 'collaboration_interests'
  > | null
}

export interface GschOpportunity {
  id: string
  organization_id: string
  city_id: string | null
  title: string
  summary: string | null
  description: string | null
  category: GschOpportunityCategory
  country: string | null
  continent: string | null
  location_label: string | null
  starts_at: string | null
  ends_at: string | null
  application_deadline: string | null
  external_url: string | null
  contact_email: string | null
  tags: string[]
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
  organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  city?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export type GschProjectCategory =
  | 'renewable_energy'
  | 'infrastructure'
  | 'real_estate'
  | 'transportation'
  | 'agriculture'
  | 'manufacturing'
  | 'technology'
  | 'tourism'
  | 'water_management'

export type GschProjectStage =
  | 'concept'
  | 'feasibility'
  | 'development'
  | 'funding'
  | 'construction'
  | 'operational'
  | 'completed'

export type GschProjectVerificationStatus =
  | 'unverified'
  | 'pending_review'
  | 'verified'
  | 'rejected'

export type GschProjectApplicationType = 'express_interest' | 'request_information'

export type GschProjectApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'responded'
  | 'withdrawn'
  | 'closed'

export type GschTradeEnquiryType =
  | 'buyer'
  | 'supplier'
  | 'distributor'
  | 'export'
  | 'import'
  | 'partnership'
  | 'general'

export type GschTradeEnquiryStatus = 'open' | 'responded' | 'closed' | 'withdrawn'

export const GSCH_PROJECT_CATEGORIES: { value: GschProjectCategory; label: string }[] = [
  { value: 'renewable_energy', label: 'Renewable energy' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'real_estate', label: 'Real estate' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'technology', label: 'Technology' },
  { value: 'tourism', label: 'Tourism' },
  { value: 'water_management', label: 'Water management' },
]

export const GSCH_PROJECT_STAGES: { value: GschProjectStage; label: string }[] = [
  { value: 'concept', label: 'Concept' },
  { value: 'feasibility', label: 'Feasibility' },
  { value: 'development', label: 'Development' },
  { value: 'funding', label: 'Funding' },
  { value: 'construction', label: 'Construction' },
  { value: 'operational', label: 'Operational' },
  { value: 'completed', label: 'Completed' },
]

export const GSCH_BUSINESS_SEEKING_OPTIONS = [
  { value: 'buyers', label: 'Buyers' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'distributors', label: 'Distributors' },
  { value: 'partners', label: 'Partners' },
  { value: 'investors', label: 'Investors' },
] as const

export const GSCH_BUSINESS_OFFERING_OPTIONS = [
  { value: 'products', label: 'Products' },
  { value: 'services', label: 'Services' },
  { value: 'exports', label: 'Exports' },
] as const

export const GSCH_TRADE_ENQUIRY_TYPES: {
  value: GschTradeEnquiryType
  label: string
}[] = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'export', label: 'Export' },
  { value: 'import', label: 'Import' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'general', label: 'General' },
]

export const GSCH_INVESTMENT_DISCLAIMER =
  'CribsTalk does not guarantee project returns or independently endorse every investment. No payment processing is provided on this platform.'

export interface GschProject {
  id: string
  organization_id: string
  city_id: string | null
  title: string
  description: string | null
  category: GschProjectCategory
  location_label: string | null
  country: string | null
  continent: string | null
  estimated_value_amount: number | null
  estimated_value_currency: string | null
  funding_required_amount: number | null
  funding_required_currency: string | null
  investment_structure: string | null
  project_stage: GschProjectStage
  required_partners: string[]
  document_urls: string[]
  contact_email: string | null
  contact_name: string | null
  verification_status: GschProjectVerificationStatus
  is_published: boolean
  disclaimer_acknowledged: boolean
  created_by: string
  created_at: string
  updated_at: string
  is_saved?: boolean
  organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  city?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschProjectApplication {
  id: string
  project_id: string
  organization_id: string | null
  applicant_user_id: string
  application_type: GschProjectApplicationType
  message: string | null
  contact_email: string | null
  status: GschProjectApplicationStatus
  created_at: string
  updated_at: string
  project?: Pick<GschProject, 'id' | 'title' | 'organization_id' | 'category'> | null
  organization?: Pick<GschOrganization, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschBusinessProfile {
  id: string
  organization_id: string
  display_name: string
  tagline: string | null
  description: string | null
  logo_url: string | null
  website: string | null
  country: string | null
  city: string | null
  industry_sectors: string[]
  seeking: string[]
  offering: string[]
  export_markets: string[]
  import_needs: string[]
  languages: string[]
  employee_range: string | null
  year_established: number | null
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
  organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status' | 'org_type'
  > | null
}

export interface GschTradeEnquiry {
  id: string
  from_organization_id: string
  to_organization_id: string
  to_business_profile_id: string | null
  enquiry_type: GschTradeEnquiryType
  subject: string
  message: string
  status: GschTradeEnquiryStatus
  created_by: string
  responded_by: string | null
  responded_at: string | null
  response_notes: string | null
  created_at: string
  updated_at: string
  direction?: 'sent' | 'received'
  from_organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  to_organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  to_business_profile?: Pick<
    GschBusinessProfile,
    'id' | 'display_name' | 'tagline' | 'logo_url'
  > | null
}

export type GschEducationProgramType =
  | 'student_exchange'
  | 'teacher_exchange'
  | 'research_collaboration'
  | 'scholarship'
  | 'innovation_partnership'
  | 'international_program'
  | 'other'

export type GschEducationApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'declined'
  | 'withdrawn'

export type GschTourismType =
  | 'eco'
  | 'cultural'
  | 'indigenous'
  | 'adventure'
  | 'route'
  | 'campaign'
  | 'other'

export type GschTourismPartnershipStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'declined'
  | 'withdrawn'

export type GschInnovationFocusArea =
  | 'ai_transportation'
  | 'smart_traffic'
  | 'smart_parking'
  | 'digital_twins'
  | 'public_safety'
  | 'water_management'
  | 'urban_infrastructure'
  | 'cybersecurity'
  | 'other'

export type GschInnovationChallengeStatus = 'draft' | 'open' | 'closed' | 'awarded'

export type GschInnovationSubmissionStatus =
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'selected'
  | 'declined'
  | 'withdrawn'

export type GschClimateType =
  | 'renewable_energy'
  | 'carbon_reduction'
  | 'waste_management'
  | 'recycling'
  | 'water_conservation'
  | 'climate_adaptation'
  | 'net_zero'
  | 'environmental_collaboration'
  | 'other'

export type GschClimateInterestType =
  | 'technical_partner'
  | 'financial_partner'
  | 'research'
  | 'general'

export type GschClimateInterestStatus =
  | 'submitted'
  | 'under_review'
  | 'responded'
  | 'withdrawn'
  | 'closed'

export const GSCH_EDUCATION_PROGRAM_TYPES: {
  value: GschEducationProgramType
  label: string
}[] = [
  { value: 'student_exchange', label: 'Student exchange' },
  { value: 'teacher_exchange', label: 'Teacher exchange' },
  { value: 'research_collaboration', label: 'Research collaboration' },
  { value: 'scholarship', label: 'Scholarship' },
  { value: 'innovation_partnership', label: 'Innovation partnership' },
  { value: 'international_program', label: 'International program' },
  { value: 'other', label: 'Other' },
]

export const GSCH_TOURISM_TYPES: { value: GschTourismType; label: string }[] = [
  { value: 'eco', label: 'Eco-tourism' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'indigenous', label: 'Indigenous' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'route', label: 'Route' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'other', label: 'Other' },
]

export const GSCH_INNOVATION_FOCUS_AREAS: {
  value: GschInnovationFocusArea
  label: string
}[] = [
  { value: 'ai_transportation', label: 'AI transportation' },
  { value: 'smart_traffic', label: 'Smart traffic' },
  { value: 'smart_parking', label: 'Smart parking' },
  { value: 'digital_twins', label: 'Digital twins' },
  { value: 'public_safety', label: 'Public safety' },
  { value: 'water_management', label: 'Water management' },
  { value: 'urban_infrastructure', label: 'Urban infrastructure' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'other', label: 'Other' },
]

export const GSCH_INNOVATION_CHALLENGE_STATUSES: {
  value: GschInnovationChallengeStatus
  label: string
}[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'awarded', label: 'Awarded' },
]

export const GSCH_CLIMATE_TYPES: { value: GschClimateType; label: string }[] = [
  { value: 'renewable_energy', label: 'Renewable energy' },
  { value: 'carbon_reduction', label: 'Carbon reduction' },
  { value: 'waste_management', label: 'Waste management' },
  { value: 'recycling', label: 'Recycling' },
  { value: 'water_conservation', label: 'Water conservation' },
  { value: 'climate_adaptation', label: 'Climate adaptation' },
  { value: 'net_zero', label: 'Net zero' },
  { value: 'environmental_collaboration', label: 'Environmental collaboration' },
  { value: 'other', label: 'Other' },
]

export const GSCH_CLIMATE_INTEREST_TYPES: {
  value: GschClimateInterestType
  label: string
}[] = [
  { value: 'technical_partner', label: 'Technical partner' },
  { value: 'financial_partner', label: 'Financial partner' },
  { value: 'research', label: 'Research' },
  { value: 'general', label: 'General' },
]

export const GSCH_CLIMATE_SEEKING_OPTIONS = [
  { value: 'technical', label: 'Technical' },
  { value: 'financial', label: 'Financial' },
  { value: 'research', label: 'Research' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'policy', label: 'Policy' },
] as const

export interface GschEducationProgram {
  id: string
  organization_id: string
  city_id: string | null
  title: string
  summary: string | null
  description: string | null
  program_type: GschEducationProgramType
  institution_name: string | null
  country: string | null
  continent: string | null
  location_label: string | null
  eligibility: string | null
  duration_label: string | null
  starts_at: string | null
  ends_at: string | null
  application_deadline: string | null
  external_url: string | null
  contact_email: string | null
  tags: string[]
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
  organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  city?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschEducationApplication {
  id: string
  program_id: string
  applicant_user_id: string
  organization_id: string | null
  message: string | null
  contact_email: string | null
  status: GschEducationApplicationStatus
  created_at: string
  updated_at: string
  program?: Pick<
    GschEducationProgram,
    'id' | 'title' | 'organization_id' | 'program_type'
  > | null
  organization?: Pick<GschOrganization, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschTourismInitiative {
  id: string
  organization_id: string
  city_id: string | null
  title: string
  summary: string | null
  description: string | null
  tourism_type: GschTourismType
  country: string | null
  continent: string | null
  location_label: string | null
  season_label: string | null
  partnership_needs: string[]
  external_url: string | null
  contact_email: string | null
  tags: string[]
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
  organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  city?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschTourismPartnershipRequest {
  id: string
  initiative_id: string
  from_organization_id: string
  message: string
  status: GschTourismPartnershipStatus
  created_by: string
  created_at: string
  updated_at: string
  initiative?: Pick<
    GschTourismInitiative,
    'id' | 'title' | 'organization_id' | 'tourism_type'
  > | null
  from_organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
}

export interface GschInnovationChallenge {
  id: string
  organization_id: string
  city_id: string | null
  title: string
  summary: string | null
  description: string | null
  focus_area: GschInnovationFocusArea
  country: string | null
  continent: string | null
  location_label: string | null
  prize_or_benefit: string | null
  submission_deadline: string | null
  external_url: string | null
  contact_email: string | null
  tags: string[]
  status: GschInnovationChallengeStatus
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
  organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  city?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschInnovationSubmission {
  id: string
  challenge_id: string
  organization_id: string | null
  submitter_user_id: string
  title: string
  proposal: string
  document_urls: string[]
  contact_email: string | null
  status: GschInnovationSubmissionStatus
  created_at: string
  updated_at: string
  challenge?: Pick<
    GschInnovationChallenge,
    'id' | 'title' | 'organization_id' | 'focus_area'
  > | null
  organization?: Pick<GschOrganization, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschClimateProject {
  id: string
  organization_id: string
  city_id: string | null
  title: string
  summary: string | null
  description: string | null
  climate_type: GschClimateType
  country: string | null
  continent: string | null
  location_label: string | null
  seeking_partners: string[]
  estimated_impact: string | null
  external_url: string | null
  contact_email: string | null
  tags: string[]
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
  organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  city?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschClimateInterest {
  id: string
  climate_project_id: string
  organization_id: string | null
  applicant_user_id: string
  interest_type: GschClimateInterestType
  message: string | null
  status: GschClimateInterestStatus
  created_at: string
  updated_at: string
  climate_project?: Pick<
    GschClimateProject,
    'id' | 'title' | 'organization_id' | 'climate_type'
  > | null
  organization?: Pick<GschOrganization, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export type GschAgreementTemplateType =
  | 'sister_city'
  | 'economic'
  | 'tourism'
  | 'education'
  | 'climate'
  | 'custom'

export type GschAgreementStatus =
  | 'draft'
  | 'submitted'
  | 'discussion'
  | 'approved'
  | 'signed'
  | 'active'
  | 'completed'
  | 'cancelled'

export type GschAgreementMilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'skipped'

export type GschAgreementApprovalAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'comment'
  | 'signed_intent'

export type GschEventType =
  | 'conference'
  | 'trade_mission'
  | 'workshop'
  | 'summit'
  | 'cultural'
  | 'networking'
  | 'other'

export type GschEventRegistrationStatus = 'registered' | 'cancelled' | 'attended'

export const GSCH_AGREEMENT_DISCLAIMER =
  'Recording approval or signature intent in CribsTalk is not a legally binding electronic signature. Integrate a compliant e-signature provider before treating agreements as executed.'

export const GSCH_AGREEMENT_TEMPLATE_TYPES: {
  value: GschAgreementTemplateType
  label: string
}[] = [
  { value: 'sister_city', label: 'Sister city' },
  { value: 'economic', label: 'Economic' },
  { value: 'tourism', label: 'Tourism' },
  { value: 'education', label: 'Education' },
  { value: 'climate', label: 'Climate' },
  { value: 'custom', label: 'Custom' },
]

export const GSCH_AGREEMENT_STATUSES: {
  value: GschAgreementStatus
  label: string
}[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'approved', label: 'Approved' },
  { value: 'signed', label: 'Signed (intent)' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const GSCH_AGREEMENT_MILESTONE_STATUSES: {
  value: GschAgreementMilestoneStatus
  label: string
}[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'skipped', label: 'Skipped' },
]

export const GSCH_EVENT_TYPES: { value: GschEventType; label: string }[] = [
  { value: 'conference', label: 'Conference' },
  { value: 'trade_mission', label: 'Trade mission' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'summit', label: 'Summit' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'networking', label: 'Networking' },
  { value: 'other', label: 'Other' },
]

export interface GschAgreement {
  id: string
  partnership_id: string | null
  template_type: GschAgreementTemplateType
  title: string
  organization_a_id: string
  organization_b_id: string
  city_a_id: string | null
  city_b_id: string | null
  objectives: string | null
  duration_label: string | null
  responsibilities_a: string | null
  responsibilities_b: string | null
  document_urls: string[]
  status: GschAgreementStatus
  created_by: string
  created_at: string
  updated_at: string
  organization_a?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  organization_b?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  city_a?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
  city_b?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschAgreementMilestone {
  id: string
  agreement_id: string
  title: string
  description: string | null
  due_at: string | null
  status: GschAgreementMilestoneStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export interface GschAgreementApproval {
  id: string
  agreement_id: string
  organization_id: string
  approver_user_id: string
  action: GschAgreementApprovalAction
  notes: string | null
  created_at: string
  organization?: Pick<GschOrganization, 'id' | 'name' | 'logo_url'> | null
}

export interface GschEvent {
  id: string
  organization_id: string
  city_id: string | null
  title: string
  summary: string | null
  description: string | null
  event_type: GschEventType
  country: string | null
  continent: string | null
  location_label: string | null
  starts_at: string | null
  ends_at: string | null
  external_url: string | null
  contact_email: string | null
  tags: string[]
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
  is_registered?: boolean
  organization?: Pick<
    GschOrganization,
    'id' | 'name' | 'country' | 'logo_url' | 'verification_status'
  > | null
  city?: Pick<GschCity, 'id' | 'name' | 'country' | 'logo_url'> | null
}

export interface GschEventRegistration {
  id: string
  event_id: string
  user_id: string
  organization_id: string | null
  status: GschEventRegistrationStatus
  created_at: string
  updated_at: string
}

export interface GschAnalyticsSnapshot {
  total_organizations: number
  verified_organizations: number
  verified_cities: number
  countries_represented: number
  active_partnerships: number
  investment_projects_published: number
  business_profiles_published: number
  education_programs: number
  tourism_initiatives: number
  innovation_challenges: number
  climate_projects: number
  opportunities: number
  events: number
  agreements_by_status: Record<string, number>
  my_org?: {
    organization_id: string
    published_events: number
    agreements: number
    partnerships: number
    opportunities: number
  } | null
}

/** City-to-city link drawn on the Global Hub map. */
export interface GschMapConnection {
  id: string
  from_city_id: string
  to_city_id: string
  kind: 'partnership' | 'match'
  label?: string | null
}

export interface GschHomeSummary {
  featured_cities: GschCity[]
  my_organizations: GschOrganization[]
  recent_verified_orgs: GschOrganization[]
  my_follows: GschCity[]
  verification_cta: {
    needs_org: boolean
    needs_verification: boolean
    pending_count: number
    draft_org_id: string | null
  }
  recommended_matches: GschMatchRecommendation[]
  pending_partnership_requests: number
  trending_opportunities: GschOpportunity[]
  featured_projects: GschProject[]
  recent_business_profiles: GschBusinessProfile[]
  education_highlights: GschEducationProgram[]
  tourism_highlights: GschTourismInitiative[]
  innovation_highlights: GschInnovationChallenge[]
  climate_highlights: GschClimateProject[]
  upcoming_events?: GschEvent[]
  /** Partnership / match edges for the dashboard map. */
  map_connections?: GschMapConnection[]
  /** Extra cities needed to render map connection endpoints. */
  map_cities?: GschCity[]
  analytics_snapshot?: Pick<
    GschAnalyticsSnapshot,
    | 'total_organizations'
    | 'verified_organizations'
    | 'verified_cities'
    | 'active_partnerships'
    | 'investment_projects_published'
    | 'opportunities'
    | 'events'
  > & {
    pending_agreements?: number
  } | null
}
