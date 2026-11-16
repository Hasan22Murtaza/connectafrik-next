export type YouthOrgVerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended'
export type YouthOrgMemberRole = 'admin' | 'coordinator' | 'viewer'
export type YouthOrgMemberStatus = 'active' | 'invited' | 'removed'

export type YouthProgramStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'closed'
  | 'archived'
  | 'suspended'

export type YouthProgramFormat = 'online' | 'in_person' | 'hybrid'

export type YouthApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'waitlisted'
  | 'rejected'
  | 'withdrawn'
  | 'completed'

export type YouthGuardianApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'rejected'

export type YouthEnrollmentStatus = 'active' | 'completed' | 'withdrawn' | 'removed'

export type YouthMentorVerificationStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'suspended'

export type YouthMentorshipStatus =
  | 'requested'
  | 'pending_guardian'
  | 'active'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'suspended'

export type YouthProjectStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'completed'
  | 'cancelled'

export type YouthProjectMemberRole = 'coordinator' | 'participant' | 'volunteer'
export type YouthProjectMemberStatus =
  | 'invited'
  | 'active'
  | 'completed'
  | 'removed'
  | 'left'

export type YouthTaskPriority = 'low' | 'medium' | 'high'
export type YouthTaskStatus = 'todo' | 'in_progress' | 'completed' | 'verified'

export type YouthEventType =
  | 'workshop'
  | 'webinar'
  | 'leadership_session'
  | 'mentorship_session'
  | 'community_event'
  | 'training'

export type YouthEventFormat = 'online' | 'in_person' | 'hybrid'
export type YouthEventStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
export type YouthAttendanceStatus = 'registered' | 'attended' | 'absent' | 'cancelled'

export type YouthAchievementType =
  | 'program_completion'
  | 'skill'
  | 'course'
  | 'volunteer'
  | 'project_contribution'
  | 'mentorship_milestone'
  | 'badge'
  | 'certificate'
  | 'other'

export type YouthAchievementVerificationStatus = 'pending' | 'verified' | 'rejected'

export type YouthSafetyReportType =
  | 'safety'
  | 'harassment'
  | 'inappropriate_content'
  | 'suspicious_contact'
  | 'child_abuse'
  | 'policy_violation'
  | 'other'

export type YouthSafetyReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed'

export type YouthApplicationQuestion = {
  id: string
  prompt: string
  required?: boolean
  maxLength?: number
}

export interface YouthProgramCategory {
  id: string
  slug: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
}

export interface YouthOrganization {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  website: string | null
  country: string | null
  region: string | null
  verification_status: YouthOrgVerificationStatus
  created_by: string
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface YouthProgram {
  id: string
  organization_id: string
  title: string
  description: string | null
  objectives: string | null
  category_id: string | null
  category_slug: string | null
  eligibility: string | null
  minimum_age: number | null
  maximum_age: number | null
  required_skills: string[] | null
  format: YouthProgramFormat
  location_region: string | null
  country: string | null
  schedule: string | null
  requirements: string | null
  safety_information: string | null
  start_date: string | null
  end_date: string | null
  application_deadline: string | null
  capacity: number | null
  seats_taken: number
  requires_guardian_approval: boolean
  application_questions: YouthApplicationQuestion[]
  status: YouthProgramStatus
  popularity_score: number
  created_by: string
  published_at: string | null
  created_at: string
  updated_at: string
  organization?: Pick<
    YouthOrganization,
    'id' | 'name' | 'logo_url' | 'verification_status' | 'country' | 'region'
  > | null
  category?: Pick<YouthProgramCategory, 'id' | 'slug' | 'name'> | null
  my_application?: YouthProgramApplication | null
  my_enrollment?: YouthProgramEnrollment | null
}

export interface YouthProgramApplication {
  id: string
  program_id: string
  user_id: string
  status: YouthApplicationStatus
  application_data: Record<string, unknown>
  guardian_approval_status: YouthGuardianApprovalStatus | null
  guardian_reviewed_by: string | null
  guardian_reviewed_at: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  program?: Pick<YouthProgram, 'id' | 'title' | 'status' | 'organization_id'> | null
}

export interface YouthProgramEnrollment {
  id: string
  program_id: string
  user_id: string
  application_id: string | null
  status: YouthEnrollmentStatus
  enrolled_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
  program?: Pick<YouthProgram, 'id' | 'title' | 'status' | 'organization_id'> | null
}

export interface YouthMentor {
  id: string
  user_id: string
  expertise: string[] | null
  skills: string[] | null
  bio: string | null
  languages: string[] | null
  experience_summary: string | null
  mentorship_interests: string[] | null
  availability: Record<string, unknown>
  verification_status: YouthMentorVerificationStatus
  verified_by: string | null
  verified_at: string | null
  accepts_minors: boolean
  created_at: string
  updated_at: string
  profile?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface YouthMentorshipMatch {
  id: string
  mentor_id: string
  participant_id: string
  program_id: string | null
  status: YouthMentorshipStatus
  goals: unknown[]
  progress_notes: unknown[]
  guardian_approval_status: YouthGuardianApprovalStatus | null
  chat_thread_id: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
  mentor?: YouthMentor | null
}

export interface YouthProject {
  id: string
  organization_id: string | null
  program_id: string | null
  title: string
  description: string | null
  objective: string | null
  skills_required: string[] | null
  max_participants: number | null
  status: YouthProjectStatus
  start_date: string | null
  end_date: string | null
  milestones: unknown[]
  created_by: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  organization?: Pick<YouthOrganization, 'id' | 'name'> | null
  member_count?: number
  my_membership?: YouthProjectMember | null
}

export interface YouthProjectMember {
  id: string
  project_id: string
  user_id: string
  role: YouthProjectMemberRole
  status: YouthProjectMemberStatus
  joined_at: string | null
  created_at: string
  updated_at: string
}

export interface YouthProjectTask {
  id: string
  project_id: string
  assigned_to: string | null
  title: string
  description: string | null
  priority: YouthTaskPriority
  due_date: string | null
  status: YouthTaskStatus
  completed_at: string | null
  verified_by: string | null
  verified_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface YouthEvent {
  id: string
  organization_id: string | null
  program_id: string | null
  project_id: string | null
  group_event_id: string | null
  title: string
  description: string | null
  event_type: YouthEventType
  start_at: string
  end_at: string | null
  format: YouthEventFormat
  location_region: string | null
  access_info: string | null
  capacity: number | null
  status: YouthEventStatus
  created_by: string
  created_at: string
  updated_at: string
  attendance_count?: number
  my_attendance?: YouthEventAttendance | null
}

export interface YouthEventAttendance {
  id: string
  event_id: string
  user_id: string
  attendance_status: YouthAttendanceStatus
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface YouthAchievement {
  id: string
  user_id: string
  program_id: string | null
  project_id: string | null
  organization_id: string | null
  achievement_type: YouthAchievementType
  title: string
  description: string | null
  skills: string[] | null
  verification_status: YouthAchievementVerificationStatus
  verified_by: string | null
  verified_at: string | null
  certificate_url: string | null
  badge_slug: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface YouthSafetyReport {
  id: string
  reporter_id: string
  reported_user_id: string | null
  program_id: string | null
  project_id: string | null
  mentorship_id: string | null
  organization_id: string | null
  report_type: YouthSafetyReportType
  description: string
  status: YouthSafetyReportStatus
  reviewed_by: string | null
  reviewed_at: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

export interface YouthDashboardSummary {
  active_programs: number
  applications: number
  upcoming_events: number
  current_projects: number
  mentorships: number
  achievements: number
  certificates: number
  programs_completed: number
  projects_completed: number
  skills: string[]
  upcoming: {
    application_deadlines: YouthProgram[]
    events: YouthEvent[]
    tasks: Pick<YouthProjectTask, 'id' | 'title' | 'status' | 'due_date'>[]
    mentorship_sessions: YouthMentorshipMatch[]
  }
}

export const DEFAULT_APPLICATION_QUESTIONS: YouthApplicationQuestion[] = [
  {
    id: 'interest',
    prompt: 'Why are you interested in this program?',
    required: true,
    maxLength: 1000,
  },
  {
    id: 'learn',
    prompt: 'What do you want to learn?',
    required: true,
    maxLength: 1000,
  },
  {
    id: 'experience',
    prompt: 'What leadership experience do you have?',
    required: false,
    maxLength: 1000,
  },
  {
    id: 'community_problem',
    prompt: 'What community problem would you like to solve?',
    required: false,
    maxLength: 1000,
  },
  {
    id: 'skills',
    prompt: 'What skills do you want to develop?',
    required: false,
    maxLength: 1000,
  },
]

export const COORDINATOR_ONLY_APPLICATION_STATUSES: YouthApplicationStatus[] = [
  'under_review',
  'accepted',
  'waitlisted',
  'rejected',
  'completed',
]

export const PARTICIPANT_APPLICATION_STATUSES: YouthApplicationStatus[] = [
  'draft',
  'submitted',
  'withdrawn',
]
