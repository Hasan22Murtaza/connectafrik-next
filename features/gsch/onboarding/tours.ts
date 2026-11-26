import type { ScreenTourConfig } from '@/shared/onboarding'

const nav = (key: string) => `[data-tour="gsch-nav-${key}"]`
const page = (key: string) => `[data-tour="gsch-${key}"]`

/** Screen-by-screen guided tours mapped to real GSCH routes and UI. */
export const GSCH_TOURS: ScreenTourConfig[] = [
  {
    module: 'gsch',
    screenKey: 'home',
    exactPaths: ['/global-hub'],
    pathPrefixes: [],
    steps: [
      {
        title: 'Welcome to the Global Hub!',
        description:
          'Connect cities worldwide, create partnerships, explore collaboration opportunities, and build international relationships — all from this hub.',
      },
      {
        element: page('home-welcome'),
        title: 'Your hub dashboard',
        description:
          'See key statistics, the interactive city map, recommended matches, opportunities, and upcoming events tailored to your organizations.',
        side: 'bottom',
      },
      {
        element: page('home-map'),
        title: 'Interactive global map',
        description:
          'Explore participating cities worldwide. Filter by continent or country, zoom in, and open a city profile from any marker.',
        side: 'top',
        optional: true,
      },
      {
        element: nav('discover'),
        title: 'Discover cities',
        description: 'Browse published city profiles by region, industry, and collaboration interests.',
        side: 'right',
      },
      {
        element: nav('partnerships'),
        title: 'Partnerships',
        description: 'Send and manage sister-city partnership requests with other organizations.',
        side: 'right',
      },
      {
        element: nav('investment'),
        title: 'Investment projects',
        description: 'Discover and publish investment opportunities across partner cities.',
        side: 'right',
      },
     
    ],
  },
  {
    module: 'gsch',
    screenKey: 'discover',
    pathPrefixes: ['/global-hub/discover'],
    steps: [
      {
        title: 'Discover cities',
        description:
          'Search and explore published city profiles to find potential sister-city partners around the world.',
      },
      {
        element: page('page-header'),
        title: 'City discovery',
        description: 'Filter by country, continent, industry, and collaboration interests to narrow results.',
        side: 'bottom',
      },
      {
        element: page('filters'),
        title: 'Filters',
        description: 'Open filters to refine the city list. Follow cities you care about to track them later.',
        side: 'left',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Results',
        description: 'Open any city to view its profile, industries, and collaboration interests.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'organization',
    pathPrefixes: ['/global-hub/organization'],
    steps: [
      {
        title: 'Organizations',
        description:
          'Register and manage the organizations that represent your city or institution in the Global Hub.',
      },
      {
        element: page('primary-cta'),
        title: 'Create an organization',
        description:
          'Start here to create an organization. You will need one before verification and city profiles.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Your organizations',
        description: 'Browse, edit, and open organizations you belong to.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'verification',
    pathPrefixes: ['/global-hub/verification'],
    steps: [
      {
        title: 'Verification',
        description:
          'Submit documents for human review. Organizations are never auto-verified — reviews keep the hub trustworthy.',
      },
      {
        element: page('page-header'),
        title: 'Verification requests',
        description: 'Track submission status and upload supporting documents for your organization.',
        side: 'bottom',
      },
      {
        element: page('primary-cta'),
        title: 'Submit for review',
        description: 'Start a new verification request once your organization is ready.',
        side: 'left',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'cities',
    pathPrefixes: ['/global-hub/cities'],
    steps: [
      {
        title: 'City profiles',
        description:
          'Create and manage city profiles that showcase your community to potential sister-city partners.',
      },
      {
        element: page('primary-cta'),
        title: 'Create a city profile',
        description: 'Publish details like industries, population, and collaboration interests.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Managed cities',
        description: 'Edit, publish, or open any city profile linked to your organizations.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'matching',
    pathPrefixes: ['/global-hub/matching'],
    steps: [
      {
        title: 'Partner matching',
        description:
          'See compatibility scores between cities based on shared interests, industries, and collaboration goals.',
      },
      {
        element: page('primary-cta'),
        title: 'Recompute matches',
        description: 'Refresh match scores when your city profiles or interests change.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Match results',
        description: 'Review recommended partners and open city profiles to explore further.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'partnerships',
    pathPrefixes: ['/global-hub/partnerships'],
    steps: [
      {
        title: 'Sister city partnerships',
        description: 'Create and manage international partnership requests between organizations.',
      },
      {
        element: page('primary-cta'),
        title: 'New partnership request',
        description: 'Propose a partnership to another organization and track responses here.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('tabs'),
        title: 'Incoming & outgoing',
        description: 'Switch between requests you sent and requests waiting for your response.',
        side: 'bottom',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'agreements',
    pathPrefixes: ['/global-hub/agreements'],
    steps: [
      {
        title: 'Partnership Builder',
        description:
          'Draft structured agreements, track milestones, and record approval intent. This is not legal e-signature.',
      },
      {
        element: page('primary-cta'),
        title: 'New agreement',
        description: 'Start a draft agreement with objectives, responsibilities, and milestones.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Agreement list',
        description: 'Open any agreement to update status, milestones, and approvals.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'opportunities',
    pathPrefixes: ['/global-hub/opportunities'],
    steps: [
      {
        title: 'Opportunities',
        description: 'Discover grants, missions, and collaboration calls published by partner cities.',
      },
      {
        element: page('filters'),
        title: 'Find opportunities',
        description: 'Filter by category, location, and deadlines to find the right fit.',
        side: 'left',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Opportunity listings',
        description: 'Open an opportunity for full details and next steps.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'investment',
    pathPrefixes: ['/global-hub/investment'],
    steps: [
      {
        title: 'Investment marketplace',
        description: 'Discover and publish investment projects seeking partners across sister cities.',
      },
      {
        element: page('primary-cta'),
        title: 'Publish a project',
        description: 'Share an investment opportunity from your organization when you have permission.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('tabs'),
        title: 'Browse modes',
        description: 'Switch between Discover, Mine, and Saved to manage your investment pipeline.',
        side: 'bottom',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'business',
    pathPrefixes: ['/global-hub/business'],
    steps: [
      {
        title: 'Business Connection Centre',
        description: 'Connect businesses across partner cities and send trade enquiries.',
      },
      {
        element: page('primary-cta'),
        title: 'Create a business profile',
        description: 'Publish your business presence so partners can find and contact you.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Business directory',
        description: 'Browse profiles and open one to send a trade enquiry.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'education',
    pathPrefixes: ['/global-hub/education'],
    steps: [
      {
        title: 'Education Exchange',
        description: 'Explore and publish education programs for cross-city learning and exchange.',
      },
      {
        element: page('primary-cta'),
        title: 'Create a program',
        description: 'Authorized org members can publish education exchange programs here.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Programs',
        description: 'Browse published programs or switch to yours to manage applications.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'tourism',
    pathPrefixes: ['/global-hub/tourism'],
    steps: [
      {
        title: 'Eco-Tourism Collaboration',
        description:
          'Discover and partner on eco, cultural, indigenous, and adventure tourism initiatives.',
      },
      {
        element: page('primary-cta'),
        title: 'Create an initiative',
        description: 'Publish a tourism collaboration opportunity for partner cities.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Initiatives',
        description: 'Browse initiatives and request collaboration where available.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'smart-cities',
    pathPrefixes: ['/global-hub/smart-cities'],
    steps: [
      {
        title: 'Smart Cities Innovation Lab',
        description:
          'Open innovation challenges across AI transportation, digital twins, public safety, and urban infrastructure.',
      },
      {
        element: page('primary-cta'),
        title: 'Create a challenge',
        description: 'Publish an innovation challenge for cities and innovators to join.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Challenges',
        description: 'Explore open challenges and submit solutions when eligible.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'climate',
    pathPrefixes: ['/global-hub/climate'],
    steps: [
      {
        title: 'Climate projects',
        description: 'Create and explore environmental initiatives with partner cities.',
      },
      {
        element: page('primary-cta'),
        title: 'Publish a climate project',
        description: 'Share climate action projects seeking partners or interest.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('tabs'),
        title: 'Discover or manage',
        description: 'Toggle between published projects and those from your organizations.',
        side: 'bottom',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'events',
    pathPrefixes: ['/global-hub/events'],
    steps: [
      {
        title: 'Global Events',
        description: 'Discover sister-city events and register your interest or attendance.',
      },
      {
        element: page('primary-cta'),
        title: 'Create an event',
        description: 'Publish events hosted by your organization for the global hub community.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Event listings',
        description: 'Open an event for details and registration options.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'gsch',
    screenKey: 'analytics',
    pathPrefixes: ['/global-hub/analytics'],
    steps: [
      {
        title: 'Analytics',
        description: 'Review live platform aggregates for organizations, partnerships, and activity.',
      },
      {
        element: page('page-header'),
        title: 'Hub analytics',
        description: 'Use these metrics to understand engagement across the Global Hub.',
        side: 'bottom',
      },
    ],
  },
]
