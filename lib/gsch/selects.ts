export const GSCH_PROJECT_SELECT = `
  id, organization_id, city_id, title, description, category,
  location_label, country, continent,
  estimated_value_amount, estimated_value_currency,
  funding_required_amount, funding_required_currency,
  investment_structure, project_stage, required_partners, document_urls,
  contact_email, contact_name, verification_status, is_published,
  disclaimer_acknowledged, created_by, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url, verification_status
  ),
  city:gsch_cities!city_id(id, name, country, logo_url)
`

export const GSCH_BUSINESS_PROFILE_SELECT = `
  id, organization_id, display_name, tagline, description, logo_url,
  website, country, city, industry_sectors, seeking, offering,
  export_markets, import_needs, languages, employee_range,
  year_established, is_published, created_by, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url, verification_status, org_type
  )
`

export const GSCH_TRADE_ENQUIRY_SELECT = `
  id, from_organization_id, to_organization_id, to_business_profile_id,
  enquiry_type, subject, message, status, created_by, responded_by,
  responded_at, response_notes, created_at, updated_at,
  from_organization:gsch_organizations!from_organization_id(
    id, name, country, logo_url, verification_status
  ),
  to_organization:gsch_organizations!to_organization_id(
    id, name, country, logo_url, verification_status
  ),
  to_business_profile:gsch_business_profiles!to_business_profile_id(
    id, display_name, tagline, logo_url
  )
`

export const GSCH_EDUCATION_PROGRAM_SELECT = `
  id, organization_id, city_id, title, summary, description, program_type,
  institution_name, country, continent, location_label, eligibility,
  duration_label, starts_at, ends_at, application_deadline, external_url,
  contact_email, tags, is_published, created_by, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url, verification_status
  ),
  city:gsch_cities!city_id(id, name, country, logo_url)
`

export const GSCH_EDUCATION_APPLICATION_SELECT = `
  id, program_id, applicant_user_id, organization_id, message, contact_email,
  status, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url
  ),
  program:gsch_education_programs!program_id(
    id, title, organization_id, program_type
  )
`

export const GSCH_TOURISM_INITIATIVE_SELECT = `
  id, organization_id, city_id, title, summary, description, tourism_type,
  country, continent, location_label, season_label, partnership_needs,
  external_url, contact_email, tags, is_published, created_by, created_at,
  updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url, verification_status
  ),
  city:gsch_cities!city_id(id, name, country, logo_url)
`

export const GSCH_TOURISM_REQUEST_SELECT = `
  id, initiative_id, from_organization_id, message, status, created_by,
  created_at, updated_at,
  from_organization:gsch_organizations!from_organization_id(
    id, name, country, logo_url, verification_status
  ),
  initiative:gsch_tourism_initiatives!initiative_id(
    id, title, organization_id, tourism_type
  )
`

export const GSCH_INNOVATION_CHALLENGE_SELECT = `
  id, organization_id, city_id, title, summary, description, focus_area,
  country, continent, location_label, prize_or_benefit, submission_deadline,
  external_url, contact_email, tags, status, is_published, created_by,
  created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url, verification_status
  ),
  city:gsch_cities!city_id(id, name, country, logo_url)
`

export const GSCH_INNOVATION_SUBMISSION_SELECT = `
  id, challenge_id, organization_id, submitter_user_id, title, proposal,
  document_urls, contact_email, status, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url
  ),
  challenge:gsch_innovation_challenges!challenge_id(
    id, title, organization_id, focus_area
  )
`

export const GSCH_CLIMATE_PROJECT_SELECT = `
  id, organization_id, city_id, title, summary, description, climate_type,
  country, continent, location_label, seeking_partners, estimated_impact,
  external_url, contact_email, tags, is_published, created_by, created_at,
  updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url, verification_status
  ),
  city:gsch_cities!city_id(id, name, country, logo_url)
`

export const GSCH_CLIMATE_INTEREST_SELECT = `
  id, climate_project_id, organization_id, applicant_user_id, interest_type,
  message, status, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url
  ),
  climate_project:gsch_climate_projects!climate_project_id(
    id, title, organization_id, climate_type
  )
`

export const GSCH_AGREEMENT_SELECT = `
  id, partnership_id, template_type, title,
  organization_a_id, organization_b_id, city_a_id, city_b_id,
  objectives, duration_label, responsibilities_a, responsibilities_b,
  document_urls, status, created_by, created_at, updated_at,
  organization_a:gsch_organizations!organization_a_id(
    id, name, country, logo_url, verification_status
  ),
  organization_b:gsch_organizations!organization_b_id(
    id, name, country, logo_url, verification_status
  ),
  city_a:gsch_cities!city_a_id(id, name, country, logo_url),
  city_b:gsch_cities!city_b_id(id, name, country, logo_url)
`

export const GSCH_AGREEMENT_MILESTONE_SELECT = `
  id, agreement_id, title, description, due_at, status, sort_order,
  created_at, updated_at
`

export const GSCH_AGREEMENT_APPROVAL_SELECT = `
  id, agreement_id, organization_id, approver_user_id, action, notes, created_at,
  organization:gsch_organizations!organization_id(id, name, logo_url)
`

export const GSCH_EVENT_SELECT = `
  id, organization_id, city_id, title, summary, description, event_type,
  country, continent, location_label, starts_at, ends_at, external_url,
  contact_email, tags, is_published, created_by, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url, verification_status
  ),
  city:gsch_cities!city_id(id, name, country, logo_url)
`

export function parseGschTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}
