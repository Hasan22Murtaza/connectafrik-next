import type { ScreenTourConfig } from '@/shared/onboarding'

const nav = (key: string) => `[data-tour="youth-nav-${key}"]`
const page = (key: string) => `[data-tour="youth-${key}"]`

/** Screen-by-screen guided tours mapped to real Youth Leadership routes and UI. */
export const YOUTH_TOURS: ScreenTourConfig[] = [
  {
    module: 'youth_leadership',
    screenKey: 'programs',
    exactPaths: ['/youth-leadership'],
    pathPrefixes: ['/youth-leadership/programs'],
    steps: [
      {
        title: 'Welcome to Youth Leadership Programs!',
        description:
          'Discover leadership pathways, track applications, and grow your skills through programs matched to you.',
      },
      {
        element: page('tabs'),
        title: 'Program hubs',
        description:
          'Switch between Discover, Enrolled, and Applications to find programs and track your progress.',
        side: 'bottom',
      },
      {
        element: page('results'),
        title: 'Program listings',
        description: 'Open a program to learn more and apply when you are eligible.',
        side: 'top',
        optional: true,
      },
      {
        element: nav('community'),
        title: 'Community',
        description: 'Explore volunteering projects and youth events with other leaders.',
        side: 'right',
        optional: true,
      },
      {
        element: nav('mentorship'),
        title: 'Mentorship',
        description: 'Connect with mentors and manage your mentorship matches.',
        side: 'right',
        optional: true,
      },
     
    ],
  },
  {
    module: 'youth_leadership',
    screenKey: 'community',
    pathPrefixes: ['/youth-leadership/community', '/youth-leadership/projects', '/youth-leadership/events'],
    steps: [
      {
        title: 'Community activities',
        description: 'Explore volunteering projects and collaboration events with other young leaders.',
      },
      {
        element: page('tabs'),
        title: 'Projects & Events',
        description: 'Toggle between community projects and upcoming events.',
        side: 'bottom',
      },
      {
        element: page('results'),
        title: 'Activity feed',
        description: 'Join projects, attend events, and track your community involvement.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'youth_leadership',
    screenKey: 'mentorship',
    pathPrefixes: ['/youth-leadership/mentorship'],
    steps: [
      {
        title: 'Mentorship',
        description: 'Find mentors, request matches, and grow through guided leadership relationships.',
      },
      {
        element: page('tabs'),
        title: 'Find mentors & matches',
        description: 'Browse available mentors or review your active mentorship matches.',
        side: 'bottom',
      },
      {
        element: page('results'),
        title: 'Mentor directory',
        description: 'Open a mentor profile to request a match. Guardian approval may be required.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'youth_leadership',
    screenKey: 'progress',
    pathPrefixes: [
      '/youth-leadership/progress',
      '/youth-leadership/dashboard',
      '/youth-leadership/achievements',
    ],
    steps: [
      {
        title: 'Your progress',
        description: 'Track leadership activities, completed milestones, badges, and achievements.',
      },
      {
        element: page('tabs'),
        title: 'Overview & Achievements',
        description: 'Switch between activity overview and badges you have earned.',
        side: 'bottom',
      },
      {
        element: page('results'),
        title: 'Progress details',
        description: 'Review enrollments, milestones, and recognition you have unlocked.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'youth_leadership',
    screenKey: 'organization',
    pathPrefixes: ['/youth-leadership/organization'],
    steps: [
      {
        title: 'Organizations',
        description:
          'Create or manage youth organizations. Coordinators can publish programs and review applications.',
      },
      {
        element: page('primary-cta'),
        title: 'Create organization',
        description: 'Register an organization if you are authorized to run youth programs.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('tabs'),
        title: 'Organization workspace',
        description:
          'Inside an organization, use Overview, Programs, Projects, and Applications tabs to manage work.',
        side: 'bottom',
        optional: true,
      },
      {
        element: page('results'),
        title: 'Your organizations',
        description: 'Open an organization to manage programs and applications.',
        side: 'top',
        optional: true,
      },
    ],
  },
  {
    module: 'youth_leadership',
    screenKey: 'guardian',
    pathPrefixes: ['/youth-leadership/guardian'],
    steps: [
      {
        title: 'Guardian approvals',
        description:
          'Parents and guardians review and approve program applications and mentorship requests for minors.',
      },
      {
        element: page('tabs'),
        title: 'Applications & Mentorships',
        description: 'Switch between pending program applications and mentorship approvals.',
        side: 'bottom',
      },
      {
        element: page('results'),
        title: 'Pending reviews',
        description: 'Approve or decline requests that require guardian consent.',
        side: 'top',
        optional: true,
      },
    ],
  },
]
