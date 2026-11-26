/**
 * Seed 12 published demo records per Global Hub page entity,
 * distributed across the provided profile IDs.
 * Idempotent: fixed UUIDs + upsert on conflict.
 *
 * Usage: node scripts/gsch-seed-data.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]
    })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const USERS = [
  '0c982b5f-283d-46ae-ab37-ceb80b1e28f3',
  'd2e6c48d-7689-41bc-8575-de50a4c5e16c',
  '52a0d42d-3dd7-4957-9aab-adc21da84b15',
  '789455a5-dec8-4a9c-8b68-7f7e40788fb4',
  'd9715dde-f476-4bee-96e6-aa373b651791',
  '60932ebb-fb13-423b-85f0-a44b6e86dfe8',
]

const uid = (prefix, n) =>
  `${prefix}-1111-4111-8111-${String(n).padStart(12, '0')}`

const ORG_IDS = Array.from({ length: 12 }, (_, i) => uid('c5010001', i + 1))
const CITY_IDS = Array.from({ length: 12 }, (_, i) => uid('c5020001', i + 1))
const VERIF_IDS = Array.from({ length: 12 }, (_, i) => uid('c5030001', i + 1))
const MATCH_IDS = Array.from({ length: 12 }, (_, i) => uid('c5040001', i + 1))
const PREQ_IDS = Array.from({ length: 12 }, (_, i) => uid('c5050001', i + 1))
const PART_IDS = Array.from({ length: 12 }, (_, i) => uid('c5060001', i + 1))
const AGR_IDS = Array.from({ length: 12 }, (_, i) => uid('c5070001', i + 1))
const OPP_IDS = Array.from({ length: 12 }, (_, i) => uid('c5080001', i + 1))
const PROJ_IDS = Array.from({ length: 12 }, (_, i) => uid('c5090001', i + 1))
const BIZ_IDS = Array.from({ length: 12 }, (_, i) => uid('c50a0001', i + 1))
const EDU_IDS = Array.from({ length: 12 }, (_, i) => uid('c50b0001', i + 1))
const TOUR_IDS = Array.from({ length: 12 }, (_, i) => uid('c50c0001', i + 1))
const INNO_IDS = Array.from({ length: 12 }, (_, i) => uid('c50d0001', i + 1))
const CLIM_IDS = Array.from({ length: 12 }, (_, i) => uid('c50e0001', i + 1))
const EVT_IDS = Array.from({ length: 12 }, (_, i) => uid('c50f0001', i + 1))
const MEM_IDS = Array.from({ length: 12 }, (_, i) => uid('c5100001', i + 1))
const FOLLOW_IDS = Array.from({ length: 12 }, (_, i) => uid('c5120001', i + 1))
const TRADE_IDS = Array.from({ length: 12 }, (_, i) => uid('c5130001', i + 1))
const MILE_IDS = Array.from({ length: 12 }, (_, i) => uid('c5140001', i + 1))

const citiesMeta = [
  { name: 'Accra', country: 'Ghana', continent: 'Africa', lat: 5.6037, lng: -0.187 },
  { name: 'Lagos', country: 'Nigeria', continent: 'Africa', lat: 6.5244, lng: 3.3792 },
  { name: 'Nairobi', country: 'Kenya', continent: 'Africa', lat: -1.2921, lng: 36.8219 },
  { name: 'Cape Town', country: 'South Africa', continent: 'Africa', lat: -33.9249, lng: 18.4241 },
  { name: 'Kigali', country: 'Rwanda', continent: 'Africa', lat: -1.9441, lng: 30.0619 },
  { name: 'Dakar', country: 'Senegal', continent: 'Africa', lat: 14.7167, lng: -17.4677 },
  { name: 'Addis Ababa', country: 'Ethiopia', continent: 'Africa', lat: 9.032, lng: 38.7469 },
  { name: 'Casablanca', country: 'Morocco', continent: 'Africa', lat: 33.5731, lng: -7.5898 },
  { name: 'Kampala', country: 'Uganda', continent: 'Africa', lat: 0.3476, lng: 32.5825 },
  { name: 'Dar es Salaam', country: 'Tanzania', continent: 'Africa', lat: -6.7924, lng: 39.2083 },
  { name: 'Abidjan', country: 'Côte d\'Ivoire', continent: 'Africa', lat: 5.36, lng: -4.0083 },
  { name: 'Lusaka', country: 'Zambia', continent: 'Africa', lat: -15.3875, lng: 28.3228 },
]

const orgTypes = [
  'municipality',
  'government_agency',
  'business',
  'startup',
  'investor',
  'chamber_of_commerce',
  'university',
  'ngo',
  'tourism_board',
  'business',
  'municipality',
  'university',
]

const interestPairs = [
  ['trade', 'Trade & Investment'],
  ['education', 'Education'],
  ['tourism', 'Tourism'],
  ['climate', 'Climate Action'],
  ['innovation', 'Innovation'],
  ['infrastructure', 'Infrastructure'],
]

async function upsert(table, rows, onConflict) {
  const { data, error } = await sb.from(table).upsert(rows, { onConflict })
  if (error) throw new Error(`${table}: ${error.message}`)
  console.log(`✓ ${table}: ${rows.length} rows`)
  return data
}

function userAt(i) {
  return USERS[i % USERS.length]
}

function partnerOrg(i) {
  return ORG_IDS[(i + 6) % 12]
}

function partnerCity(i) {
  return CITY_IDS[(i + 6) % 12]
}

async function main() {
  const { data: profiles, error: pErr } = await sb.from('profiles').select('id').in('id', USERS)
  if (pErr) throw pErr
  if ((profiles?.length || 0) < 6) {
    throw new Error(`Expected 6 profiles, found ${profiles?.length || 0}`)
  }

  const orgs = ORG_IDS.map((id, i) => {
    const meta = citiesMeta[i]
    const created_by = userAt(i)
    return {
      id,
      name: `${meta.name} ${orgTypes[i].replace(/_/g, ' ')} Hub`,
      org_type: orgTypes[i],
      country: meta.country,
      state_province: null,
      city: meta.name,
      website: `https://example.com/${meta.name.toLowerCase().replace(/\s+/g, '-')}`,
      official_email: `contact@${meta.name.toLowerCase().replace(/\s+/g, '')}.gsch.demo`,
      description: `Sister-city collaboration hub for ${meta.name}, focused on trade, education, and climate partnerships.`,
      areas_of_interest: ['trade', 'education', 'tourism', 'climate', 'innovation'],
      verification_status: 'verified',
      verification_badge:
        orgTypes[i] === 'municipality'
          ? 'verified_city'
          : orgTypes[i] === 'business' || orgTypes[i] === 'startup'
            ? 'verified_business'
            : orgTypes[i] === 'university' || orgTypes[i] === 'ngo'
              ? 'verified_institution'
              : 'verified_government',
      created_by,
      verified_by: userAt(i + 1),
      verified_at: new Date().toISOString(),
      subscription_tier: i % 3 === 0 ? 'enterprise' : i % 3 === 1 ? 'standard' : 'free',
    }
  })
  await upsert('gsch_organizations', orgs, 'id')

  const memberships = ORG_IDS.map((organization_id, i) => ({
    id: MEM_IDS[i],
    organization_id,
    user_id: userAt(i),
    role: 'owner',
    status: 'active',
  }))
  // Also add each user as member of one partner org for cross-visibility
  const extraMemberships = USERS.map((user_id, i) => ({
    id: uid('c5100002', i + 1),
    organization_id: ORG_IDS[(i + 3) % 12],
    user_id,
    role: 'representative',
    status: 'active',
  }))
  await upsert('gsch_memberships', [...memberships, ...extraMemberships], 'id')

  const cities = CITY_IDS.map((id, i) => {
    const meta = citiesMeta[i]
    return {
      id,
      organization_id: ORG_IDS[i],
      name: meta.name,
      country: meta.country,
      continent: meta.continent,
      description: `${meta.name} is seeking sister-city partners for trade, culture, climate, and smart-city collaboration.`,
      population: 800000 + i * 250000,
      official_website: `https://city.${meta.name.toLowerCase().replace(/\s+/g, '')}.example`,
      mayor_name: `Mayor ${meta.name}`,
      mayor_user_id: userAt(i),
      economic_info: `Growing services and export economy in ${meta.country}.`,
      major_industries: ['agriculture', 'tech', 'tourism', 'logistics'].slice(0, 2 + (i % 3)),
      tourism_assets: ['heritage sites', 'coastal attractions', 'cultural festivals'],
      education_institutions: [`${meta.name} University`, `${meta.name} Polytechnic`],
      infrastructure_priorities: ['transit', 'water', 'broadband'],
      investment_opportunities: `Green corridors and industrial parks around ${meta.name}.`,
      renewable_energy_initiatives: 'Solar + mini-grid expansion',
      climate_objectives: 'Net-zero municipal operations by 2040',
      export_products: ['cocoa', 'coffee', 'textiles', 'software'].slice(0, 2 + (i % 2)),
      collaboration_interests: ['trade', 'education', 'tourism', 'climate'],
      existing_sister_cities: [citiesMeta[(i + 1) % 12].name, citiesMeta[(i + 5) % 12].name],
      latitude: meta.lat,
      longitude: meta.lng,
      is_published: true,
      created_by: userAt(i),
    }
  })
  await upsert('gsch_cities', cities, 'id')

  const interests = []
  let interestN = 1
  for (let i = 0; i < 12; i++) {
    for (const [slug, label] of interestPairs.slice(0, 2 + (i % 3))) {
      interests.push({
        id: uid('c5110001', interestN++),
        city_id: CITY_IDS[i],
        interest_slug: slug,
        interest_label: label,
      })
    }
  }
  await upsert('gsch_city_interests', interests, 'id')

  const follows = Array.from({ length: 12 }, (_, i) => ({
    id: FOLLOW_IDS[i],
    city_id: CITY_IDS[i],
    user_id: userAt(i + 1),
  }))
  await upsert('gsch_city_follows', follows, 'id')

  const verifications = VERIF_IDS.map((id, i) => ({
    id,
    organization_id: ORG_IDS[i],
    submitted_by: userAt(i),
    status: i % 4 === 0 ? 'under_review' : i % 4 === 1 ? 'submitted' : 'verified',
    document_urls: [`https://docs.example.com/gsch/verification/${i + 1}.pdf`],
    notes: `Verification package for ${citiesMeta[i].name} organization.`,
    reviewer_id: i % 4 > 1 ? userAt(i + 2) : null,
    reviewed_at: i % 4 > 1 ? new Date().toISOString() : null,
    admin_notes: i % 4 > 1 ? 'Documents validated.' : null,
  }))
  await upsert('gsch_verifications', verifications, 'id')

  const matches = MATCH_IDS.map((id, i) => ({
    id,
    source_city_id: CITY_IDS[i],
    recommended_city_id: CITY_IDS[(i + 1) % 12],
    compatibility_score: 62 + ((i * 3) % 35),
    shared_interests: ['trade', 'education', 'climate'].slice(0, 2 + (i % 2)),
    collaboration_areas: ['economic', 'cultural', 'innovation'].slice(0, 2),
    score_breakdown: {
      interests: 30 + i,
      geography: 20,
      industries: 15 + (i % 10),
      partnership_history: 10,
    },
    explanation: `${citiesMeta[i].name} and ${citiesMeta[(i + 1) % 12].name} share strong trade and climate collaboration potential.`,
    algorithm_version: 'weighted_v1',
    computed_at: new Date().toISOString(),
  }))
  await upsert('gsch_match_recommendations', matches, 'id')

  const partnershipTypes = [
    'sister_city',
    'economic',
    'tourism',
    'education',
    'climate',
    'infrastructure',
    'innovation',
    'cultural',
    'economic',
    'tourism',
    'education',
    'climate',
  ]

  // Insert partnerships first so accepted requests can reference them
  const partnerships = PART_IDS.map((id, i) => ({
    id,
    request_id: null,
    title: `${citiesMeta[i].name}–${citiesMeta[(i + 6) % 12].name} Active Partnership`,
    partnership_type: partnershipTypes[i],
    organization_a_id: ORG_IDS[i],
    organization_b_id: partnerOrg(i),
    city_a_id: CITY_IDS[i],
    city_b_id: partnerCity(i),
    objectives: `Joint programs between ${citiesMeta[i].name} and ${citiesMeta[(i + 6) % 12].name}.`,
    status: i % 4 === 3 ? 'paused' : 'active',
    started_at: new Date().toISOString(),
    created_by: userAt(i),
  }))
  await upsert('gsch_partnerships', partnerships, 'id')

  const partnershipRequests = PREQ_IDS.map((id, i) => ({
    id,
    requesting_organization_id: ORG_IDS[i],
    target_organization_id: partnerOrg(i),
    requesting_city_id: CITY_IDS[i],
    target_city_id: partnerCity(i),
    title: `${citiesMeta[i].name} ↔ ${citiesMeta[(i + 6) % 12].name} partnership`,
    partnership_type: partnershipTypes[i],
    objectives: `Joint programs between ${citiesMeta[i].name} and ${citiesMeta[(i + 6) % 12].name}.`,
    proposed_duration: '3 years',
    message: 'We would like to open a formal sister-city collaboration.',
    status: i % 3 === 0 ? 'accepted' : i % 3 === 1 ? 'pending' : 'draft',
    created_by: userAt(i),
    responded_by: i % 3 === 0 ? userAt(i + 1) : null,
    responded_at: i % 3 === 0 ? new Date().toISOString() : null,
    response_notes: i % 3 === 0 ? 'Happy to proceed.' : null,
    partnership_id: i % 3 === 0 ? PART_IDS[i] : null,
  }))
  await upsert('gsch_partnership_requests', partnershipRequests, 'id')

  // Back-link request_id on partnerships
  await upsert(
    'gsch_partnerships',
    PART_IDS.map((id, i) => ({
      ...partnerships[i],
      request_id: PREQ_IDS[i],
    })),
    'id'
  )

  const agreements = AGR_IDS.map((id, i) => ({
    id,
    partnership_id: PART_IDS[i],
    template_type: ['sister_city', 'economic', 'tourism', 'education', 'climate', 'custom'][i % 6],
    title: `MoU: ${citiesMeta[i].name} & ${citiesMeta[(i + 6) % 12].name}`,
    organization_a_id: ORG_IDS[i],
    organization_b_id: partnerOrg(i),
    city_a_id: CITY_IDS[i],
    city_b_id: partnerCity(i),
    objectives: 'Record mutual intent for collaboration programs.',
    duration_label: '24 months',
    responsibilities_a: `Lead coordination from ${citiesMeta[i].name}.`,
    responsibilities_b: `Lead coordination from ${citiesMeta[(i + 6) % 12].name}.`,
    document_urls: [],
    status: ['draft', 'submitted', 'discussion', 'approved', 'signed', 'active'][i % 6],
    created_by: userAt(i),
  }))
  await upsert('gsch_agreements', agreements, 'id')

  const milestones = MILE_IDS.map((id, i) => ({
    id,
    agreement_id: AGR_IDS[i],
    title: `Milestone ${i + 1}: kickoff workshop`,
    description: 'Virtual kickoff and workplan alignment.',
    due_at: new Date(Date.now() + (i + 1) * 14 * 86400000).toISOString(),
    status: i % 3 === 0 ? 'done' : i % 3 === 1 ? 'in_progress' : 'pending',
    sort_order: 1,
  }))
  await upsert('gsch_agreement_milestones', milestones, 'id')

  const opportunities = OPP_IDS.map((id, i) => ({
    id,
    organization_id: ORG_IDS[i],
    city_id: CITY_IDS[i],
    title: `${citiesMeta[i].name} Global Opportunity`,
    summary: `Open call for partners interested in ${citiesMeta[i].name}.`,
    description: `A published opportunity from ${citiesMeta[i].name} covering grants, missions, and collaboration.`,
    category: [
      'investment',
      'grant',
      'conference',
      'trade_mission',
      'development_funding',
      'innovation_challenge',
      'sister_city',
      'education_program',
      'other',
      'grant',
      'conference',
      'investment',
    ][i],
    country: citiesMeta[i].country,
    continent: 'Africa',
    location_label: citiesMeta[i].name,
    starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    application_deadline: new Date(Date.now() + 45 * 86400000).toISOString(),
    external_url: `https://opportunities.example.com/${i + 1}`,
    contact_email: `ops@${citiesMeta[i].name.toLowerCase().replace(/\s+/g, '')}.gsch.demo`,
    tags: ['africa', 'partnership', 'open-call'],
    is_published: true,
    created_by: userAt(i),
  }))
  await upsert('gsch_opportunities', opportunities, 'id')

  const projects = PROJ_IDS.map((id, i) => ({
    id,
    organization_id: ORG_IDS[i],
    city_id: CITY_IDS[i],
    title: `${citiesMeta[i].name} Investment Project`,
    description: `Investment-ready project in ${citiesMeta[i].name} seeking co-developers and capital partners.`,
    category: [
      'renewable_energy',
      'infrastructure',
      'real_estate',
      'transportation',
      'agriculture',
      'manufacturing',
      'technology',
      'tourism',
      'water_management',
      'renewable_energy',
      'technology',
      'infrastructure',
    ][i],
    location_label: citiesMeta[i].name,
    country: citiesMeta[i].country,
    continent: 'Africa',
    estimated_value_amount: 2_500_000 + i * 750_000,
    estimated_value_currency: 'USD',
    funding_required_amount: 1_000_000 + i * 300_000,
    funding_required_currency: 'USD',
    investment_structure: 'equity + concessional blend',
    project_stage: ['concept', 'feasibility', 'development', 'funding', 'construction', 'operational'][
      i % 6
    ],
    required_partners: ['epc', 'investor', 'municipality'],
    document_urls: [],
    contact_email: `invest@${citiesMeta[i].name.toLowerCase().replace(/\s+/g, '')}.gsch.demo`,
    contact_name: `Lead ${citiesMeta[i].name}`,
    verification_status: i % 2 === 0 ? 'verified' : 'pending_review',
    is_published: true,
    disclaimer_acknowledged: true,
    created_by: userAt(i),
  }))
  await upsert('gsch_projects', projects, 'id')

  const businessProfiles = BIZ_IDS.map((id, i) => ({
    id,
    organization_id: ORG_IDS[i],
    display_name: `${citiesMeta[i].name} Trade Desk`,
    tagline: `Connecting ${citiesMeta[i].name} exporters with global partners`,
    description: `Business centre profile representing enterprises and institutions around ${citiesMeta[i].name}.`,
    website: `https://business.${citiesMeta[i].name.toLowerCase().replace(/\s+/g, '')}.example`,
    country: citiesMeta[i].country,
    city: citiesMeta[i].name,
    industry_sectors: ['agribusiness', 'fintech', 'logistics', 'tourism'].slice(0, 2 + (i % 3)),
    seeking: ['distributors', 'investors', 'joint_ventures'],
    offering: ['export_products', 'market_access', 'local_expertise'],
    export_markets: ['ECOWAS', 'EU', 'US', 'MENA'].slice(0, 2 + (i % 2)),
    import_needs: ['machinery', 'packaging', 'software'],
    languages: ['English', 'French', 'Swahili'].slice(0, 1 + (i % 3)),
    employee_range: ['1-10', '11-50', '51-200', '201-500'][i % 4],
    year_established: 1998 + i,
    is_published: true,
    created_by: userAt(i),
  }))
  await upsert('gsch_business_profiles', businessProfiles, 'id')

  const tradeEnquiries = TRADE_IDS.map((id, i) => ({
    id,
    from_organization_id: ORG_IDS[i],
    to_organization_id: partnerOrg(i),
    to_business_profile_id: BIZ_IDS[(i + 6) % 12],
    enquiry_type: ['buyer', 'supplier', 'distributor', 'export', 'import', 'partnership'][i % 6],
    subject: `Trade enquiry from ${citiesMeta[i].name}`,
    message: `Interested in supplier/distributor collaboration with ${citiesMeta[(i + 6) % 12].name}.`,
    status: i % 3 === 0 ? 'responded' : 'open',
    created_by: userAt(i),
    responded_by: i % 3 === 0 ? userAt(i + 1) : null,
    responded_at: i % 3 === 0 ? new Date().toISOString() : null,
    response_notes: i % 3 === 0 ? 'We can schedule an intro call.' : null,
  }))
  await upsert('gsch_trade_enquiries', tradeEnquiries, 'id')

  const education = EDU_IDS.map((id, i) => ({
    id,
    organization_id: ORG_IDS[i],
    city_id: CITY_IDS[i],
    title: `${citiesMeta[i].name} Exchange Program`,
    summary: `Student and faculty exchange opportunities hosted in ${citiesMeta[i].name}.`,
    description: 'Semester exchanges, research residencies, and scholarship tracks.',
    program_type: [
      'student_exchange',
      'teacher_exchange',
      'research_collaboration',
      'scholarship',
      'innovation_partnership',
      'international_program',
      'other',
      'student_exchange',
      'scholarship',
      'research_collaboration',
      'teacher_exchange',
      'international_program',
    ][i],
    institution_name: `${citiesMeta[i].name} University`,
    country: citiesMeta[i].country,
    continent: 'Africa',
    location_label: citiesMeta[i].name,
    eligibility: 'Undergraduate and postgraduate applicants',
    duration_label: '1 semester',
    starts_at: new Date(Date.now() + 60 * 86400000).toISOString(),
    ends_at: new Date(Date.now() + 200 * 86400000).toISOString(),
    application_deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    external_url: `https://edu.example.com/${i + 1}`,
    contact_email: `edu@${citiesMeta[i].name.toLowerCase().replace(/\s+/g, '')}.gsch.demo`,
    tags: ['exchange', 'education', 'africa'],
    is_published: true,
    created_by: userAt(i),
  }))
  await upsert('gsch_education_programs', education, 'id')

  const tourism = TOUR_IDS.map((id, i) => ({
    id,
    organization_id: ORG_IDS[i],
    city_id: CITY_IDS[i],
    title: `${citiesMeta[i].name} Tourism Initiative`,
    summary: `Eco and cultural tourism partnership opportunity in ${citiesMeta[i].name}.`,
    description: 'Looking for destination marketing and tour-operator partners.',
    tourism_type: ['eco', 'cultural', 'indigenous', 'adventure', 'route', 'campaign'][i % 6],
    country: citiesMeta[i].country,
    continent: 'Africa',
    location_label: citiesMeta[i].name,
    season_label: 'Year-round',
    partnership_needs: ['tour operators', 'airlines', 'hotels'],
    external_url: `https://tourism.example.com/${i + 1}`,
    contact_email: `tourism@${citiesMeta[i].name.toLowerCase().replace(/\s+/g, '')}.gsch.demo`,
    tags: ['tourism', 'culture', 'eco'],
    is_published: true,
    created_by: userAt(i),
  }))
  await upsert('gsch_tourism_initiatives', tourism, 'id')

  const challenges = INNO_IDS.map((id, i) => ({
    id,
    organization_id: ORG_IDS[i],
    city_id: CITY_IDS[i],
    title: `${citiesMeta[i].name} Smart City Challenge`,
    summary: `Innovation challenge for urban solutions in ${citiesMeta[i].name}.`,
    description: 'Submit proposals for mobility, water, safety, or digital twin pilots.',
    focus_area: [
      'ai_transportation',
      'smart_traffic',
      'smart_parking',
      'digital_twins',
      'public_safety',
      'water_management',
      'urban_infrastructure',
      'cybersecurity',
      'other',
      'ai_transportation',
      'digital_twins',
      'water_management',
    ][i],
    country: citiesMeta[i].country,
    continent: 'Africa',
    location_label: citiesMeta[i].name,
    prize_or_benefit: 'Pilot funding + city partnership',
    submission_deadline: new Date(Date.now() + 40 * 86400000).toISOString(),
    external_url: `https://smart.example.com/${i + 1}`,
    contact_email: `smart@${citiesMeta[i].name.toLowerCase().replace(/\s+/g, '')}.gsch.demo`,
    tags: ['smart-cities', 'innovation'],
    status: 'open',
    is_published: true,
    created_by: userAt(i),
  }))
  await upsert('gsch_innovation_challenges', challenges, 'id')

  const climate = CLIM_IDS.map((id, i) => ({
    id,
    organization_id: ORG_IDS[i],
    city_id: CITY_IDS[i],
    title: `${citiesMeta[i].name} Climate Project`,
    summary: `Climate action partnership open in ${citiesMeta[i].name}.`,
    description: 'Seeking technical and financial partners for municipal climate programs.',
    climate_type: [
      'renewable_energy',
      'carbon_reduction',
      'waste_management',
      'recycling',
      'water_conservation',
      'climate_adaptation',
      'net_zero',
      'environmental_collaboration',
      'other',
      'renewable_energy',
      'waste_management',
      'climate_adaptation',
    ][i],
    country: citiesMeta[i].country,
    continent: 'Africa',
    location_label: citiesMeta[i].name,
    seeking_partners: ['technical_partner', 'financial_partner', 'research'],
    estimated_impact: 'Reduce municipal emissions by 15–25% over 5 years',
    external_url: `https://climate.example.com/${i + 1}`,
    contact_email: `climate@${citiesMeta[i].name.toLowerCase().replace(/\s+/g, '')}.gsch.demo`,
    tags: ['climate', 'net-zero'],
    is_published: true,
    created_by: userAt(i),
  }))
  await upsert('gsch_climate_projects', climate, 'id')

  const events = EVT_IDS.map((id, i) => ({
    id,
    organization_id: ORG_IDS[i],
    city_id: CITY_IDS[i],
    title: `${citiesMeta[i].name} Global Hub Event`,
    summary: `Networking and partnership event hosted in/for ${citiesMeta[i].name}.`,
    description: 'Join city leaders, investors, and institutions for collaboration sessions.',
    event_type: [
      'conference',
      'trade_mission',
      'workshop',
      'summit',
      'cultural',
      'networking',
      'other',
      'conference',
      'workshop',
      'summit',
      'trade_mission',
      'networking',
    ][i],
    country: citiesMeta[i].country,
    continent: 'Africa',
    location_label: citiesMeta[i].name,
    starts_at: new Date(Date.now() + (10 + i) * 86400000).toISOString(),
    ends_at: new Date(Date.now() + (11 + i) * 86400000).toISOString(),
    external_url: `https://events.example.com/${i + 1}`,
    contact_email: `events@${citiesMeta[i].name.toLowerCase().replace(/\s+/g, '')}.gsch.demo`,
    tags: ['events', 'networking', 'africa'],
    is_published: true,
    created_by: userAt(i),
  }))
  await upsert('gsch_events', events, 'id')

  // Event registrations: each user registers for 2 events
  const registrations = []
  let regN = 1
  for (let u = 0; u < USERS.length; u++) {
    for (let e = 0; e < 2; e++) {
      const eventIndex = (u * 2 + e) % 12
      registrations.push({
        id: uid('c5150001', regN++),
        event_id: EVT_IDS[eventIndex],
        user_id: USERS[u],
        organization_id: ORG_IDS[u * 2],
        status: 'registered',
      })
    }
  }
  await upsert('gsch_event_registrations', registrations, 'id')

  console.log('\nSeed complete. Counts:')
  const tables = [
    'gsch_organizations',
    'gsch_memberships',
    'gsch_cities',
    'gsch_verifications',
    'gsch_match_recommendations',
    'gsch_partnership_requests',
    'gsch_partnerships',
    'gsch_agreements',
    'gsch_opportunities',
    'gsch_projects',
    'gsch_business_profiles',
    'gsch_trade_enquiries',
    'gsch_education_programs',
    'gsch_tourism_initiatives',
    'gsch_innovation_challenges',
    'gsch_climate_projects',
    'gsch_events',
  ]
  for (const t of tables) {
    const { count } = await sb.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ${t}: ${count}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
