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
}
