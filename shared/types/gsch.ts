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
}
