-- Youth Leadership demo seed (idempotent).
-- Uses existing profiles; skips entirely when no profiles exist.
-- Safe to re-run: fixed seed UUIDs + ON CONFLICT / existence checks.
-- Does not modify or depend on existing non-youth production data.

DO $$
DECLARE
  v_creator UUID;
  v_participant UUID;
  v_mentor_user UUID;
  v_third UUID;

  v_org1 UUID := 'a1111111-1111-4111-8111-111111111101';
  v_org2 UUID := 'a1111111-1111-4111-8111-111111111102';

  v_prog1 UUID := 'b2222222-2222-4222-8222-222222222201';
  v_prog2 UUID := 'b2222222-2222-4222-8222-222222222202';
  v_prog3 UUID := 'b2222222-2222-4222-8222-222222222203';
  v_prog4 UUID := 'b2222222-2222-4222-8222-222222222204';

  v_app1 UUID := 'c3333333-3333-4333-8333-333333333301';
  v_app2 UUID := 'c3333333-3333-4333-8333-333333333302';
  v_enroll1 UUID := 'd4444444-4444-4444-8444-444444444401';

  v_mentor1 UUID := 'e5555555-5555-4555-8555-555555555501';
  v_match1 UUID := 'f6666666-6666-4666-8666-666666666601';

  v_project1 UUID := 'a7777777-7777-4777-8777-777777777701';
  v_project2 UUID := 'a7777777-7777-4777-8777-777777777702';
  v_pmember1 UUID := 'b8888888-8888-4888-8888-888888888801';
  v_task1 UUID := 'c9999999-9999-4999-8999-999999999901';
  v_task2 UUID := 'c9999999-9999-4999-8999-999999999902';

  v_event1 UUID := 'd0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a001';
  v_event2 UUID := 'd0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a002';
  v_attend1 UUID := 'e0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b001';

  v_ach1 UUID := 'f0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001';
  v_ach2 UUID := 'f0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002';

  v_cat_leadership UUID;
  v_cat_stem UUID;
  v_cat_community UUID;
  v_cat_career UUID;

  v_questions JSONB := '[
    {"id":"interest","prompt":"Why are you interested in this program?","required":true,"maxLength":1000},
    {"id":"learn","prompt":"What do you want to learn?","required":true,"maxLength":1000},
    {"id":"experience","prompt":"What leadership experience do you have?","required":false,"maxLength":1000},
    {"id":"community_problem","prompt":"What community problem would you like to solve?","required":false,"maxLength":1000},
    {"id":"skills","prompt":"What skills do you want to develop?","required":false,"maxLength":1000}
  ]'::jsonb;
BEGIN
  -- Need at least one profile to own seed rows
  SELECT id INTO v_creator
  FROM public.profiles
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_creator IS NULL THEN
    RAISE NOTICE 'youth_leadership_seed: no profiles found — skipping seed';
    RETURN;
  END IF;

  -- Prefer distinct users when available
  SELECT id INTO v_participant
  FROM public.profiles
  WHERE id <> v_creator
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_participant IS NULL THEN
    v_participant := v_creator;
  END IF;

  SELECT id INTO v_mentor_user
  FROM public.profiles
  WHERE id NOT IN (v_creator, v_participant)
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_mentor_user IS NULL THEN
    v_mentor_user := v_creator;
  END IF;

  SELECT id INTO v_third
  FROM public.profiles
  WHERE id NOT IN (v_creator, v_participant, v_mentor_user)
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_third IS NULL THEN
    v_third := v_participant;
  END IF;

  SELECT id INTO v_cat_leadership FROM public.youth_program_categories WHERE slug = 'leadership' LIMIT 1;
  SELECT id INTO v_cat_stem FROM public.youth_program_categories WHERE slug = 'stem' LIMIT 1;
  SELECT id INTO v_cat_community FROM public.youth_program_categories WHERE slug = 'community_service' LIMIT 1;
  SELECT id INTO v_cat_career FROM public.youth_program_categories WHERE slug = 'career_development' LIMIT 1;

  -- Organizations
  INSERT INTO public.youth_organizations (
    id, name, description, logo_url, website, country, region,
    verification_status, created_by, verified_by, verified_at
  ) VALUES
  (
    v_org1,
    'Afrik Youth Leaders Network',
    'A pan-African network helping young people build leadership, civic, and community skills through mentored programs.',
    '/assets/images/avatar-1.png',
    'https://example.com/ayln',
    'Nigeria',
    'Lagos',
    'verified',
    v_creator,
    v_creator,
    now() - interval '10 days'
  ),
  (
    v_org2,
    'Green Horizon STEM Club',
    'Hands-on STEM and environmental projects for youth aged 13–24 across West Africa.',
    '/assets/images/avatar-2.png',
    'https://example.com/greenhorizon',
    'Ghana',
    'Accra',
    'verified',
    v_creator,
    v_creator,
    now() - interval '7 days'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.youth_organization_members (
    organization_id, user_id, role, status
  ) VALUES
    (v_org1, v_creator, 'admin', 'active'),
    (v_org2, v_creator, 'admin', 'active'),
    (v_org1, v_mentor_user, 'coordinator', 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Programs
  INSERT INTO public.youth_programs (
    id, organization_id, title, description, objectives, category_id, category_slug,
    eligibility, minimum_age, maximum_age, required_skills, format, location_region, country,
    schedule, requirements, safety_information, start_date, end_date, application_deadline,
    capacity, seats_taken, requires_guardian_approval, application_questions, status,
    popularity_score, created_by, published_at
  ) VALUES
  (
    v_prog1,
    v_org1,
    'Young Community Leaders Fellowship',
    'A 12-week fellowship for youth who want to lead local community projects with mentor support.',
    'Build facilitation skills, design a community project, and present impact outcomes.',
    v_cat_leadership,
    'leadership',
    'Open to motivated youth with an interest in community service.',
    14,
    24,
    ARRAY['communication', 'teamwork', 'project planning'],
    'hybrid',
    'Lagos',
    'Nigeria',
    'Saturdays 10:00–13:00 WAT + weekly mentor check-in',
    'Reliable internet for online sessions; parent/guardian consent if under 18.',
    'All mentors are verified. No private one-to-one chat with minors unless guardian-approved.',
    (CURRENT_DATE + 21),
    (CURRENT_DATE + 120),
    (now() + interval '14 days'),
    40,
    1,
    true,
    v_questions,
    'published',
    92,
    v_creator,
    now() - interval '5 days'
  ),
  (
    v_prog2,
    v_org2,
    'STEM Builders Bootcamp',
    'Learn problem-solving with coding, electronics basics, and climate-focused challenges.',
    'Complete a STEM mini-project and pitch a climate solution for your community.',
    v_cat_stem,
    'stem',
    'Curious learners with basic computer access.',
    13,
    22,
    ARRAY['problem solving', 'coding basics'],
    'online',
    'Accra',
    'Ghana',
    'Tue/Thu 17:00–18:30 GMT',
    'Laptop or tablet recommended.',
    'Sessions are group-based. Report concerns via Youth Leadership safety tools.',
    (CURRENT_DATE + 10),
    (CURRENT_DATE + 60),
    (now() + interval '10 days'),
    60,
    0,
    true,
    v_questions,
    'published',
    80,
    v_creator,
    now() - interval '3 days'
  ),
  (
    v_prog3,
    v_org1,
    'Public Speaking for Change',
    'Workshops on storytelling, confidence, and advocacy speaking for youth organizers.',
    'Deliver a short advocacy talk and receive peer feedback.',
    v_cat_career,
    'public_speaking',
    'Youth interested in advocacy and communication.',
    15,
    25,
    ARRAY['public speaking'],
    'in_person',
    'Abuja',
    'Nigeria',
    'Weekend intensives (3 sessions)',
    'Local attendance required.',
    'Adult facilitators present at all sessions.',
    (CURRENT_DATE + 30),
    (CURRENT_DATE + 45),
    (now() + interval '20 days'),
    25,
    0,
    false,
    v_questions,
    'published',
    65,
    v_creator,
    now() - interval '2 days'
  ),
  (
    v_prog4,
    v_org2,
    'Neighborhood Cleanup Leaders (Draft)',
    'Draft program for organizing youth-led cleanup campaigns.',
    'Coordinate a local cleanup and track volunteer hours.',
    v_cat_community,
    'community_service',
    'Local volunteers',
    12,
    20,
    ARRAY['volunteering'],
    'in_person',
    'Kumasi',
    'Ghana',
    'TBD',
    NULL,
    'Adult supervisor required for under-16 participants.',
    NULL,
    NULL,
    NULL,
    30,
    0,
    true,
    v_questions,
    'draft',
    10,
    v_creator,
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  -- Application + enrollment sample for participant
  INSERT INTO public.youth_program_applications (
    id, program_id, user_id, status, application_data,
    guardian_approval_status, submitted_at, reviewed_at, reviewed_by
  ) VALUES (
    v_app1,
    v_prog1,
    v_participant,
    'accepted',
    jsonb_build_object(
      'interest', 'I want to lead youth projects in my neighborhood.',
      'learn', 'Project planning and facilitation.',
      'experience', 'School debate club captain.',
      'community_problem', 'Limited safe public spaces for youth.',
      'skills', 'Leadership, communication'
    ),
    CASE WHEN v_participant = v_creator THEN 'not_required' ELSE 'approved' END,
    now() - interval '4 days',
    now() - interval '3 days',
    v_creator
  )
  ON CONFLICT (program_id, user_id) DO NOTHING;

  INSERT INTO public.youth_program_applications (
    id, program_id, user_id, status, application_data,
    guardian_approval_status, submitted_at
  ) VALUES (
    v_app2,
    v_prog2,
    v_third,
    'submitted',
    jsonb_build_object(
      'interest', 'I love STEM and climate solutions.',
      'learn', 'Coding and electronics basics.',
      'skills', 'Problem solving'
    ),
    'not_required',
    now() - interval '1 day'
  )
  ON CONFLICT (program_id, user_id) DO NOTHING;

  INSERT INTO public.youth_program_enrollments (
    id, program_id, user_id, application_id, status, enrolled_at
  )
  SELECT
    v_enroll1,
    v_prog1,
    v_participant,
    a.id,
    'active',
    now() - interval '3 days'
  FROM public.youth_program_applications a
  WHERE a.program_id = v_prog1
    AND a.user_id = v_participant
  ON CONFLICT (program_id, user_id) DO NOTHING;

  -- Mentor + match
  INSERT INTO public.youth_mentors (
    id, user_id, expertise, skills, bio, languages, experience_summary,
    mentorship_interests, availability, verification_status, verified_by, verified_at,
    accepts_minors
  ) VALUES (
    v_mentor1,
    v_mentor_user,
    ARRAY['leadership', 'career coaching', 'public speaking'],
    ARRAY['facilitation', 'goal setting', 'feedback'],
    'Educator and community organizer helping youth build confidence and leadership habits.',
    ARRAY['English', 'French'],
    '8+ years mentoring student leaders across community programs.',
    ARRAY['youth leadership', 'career pathways', 'civic engagement'],
    jsonb_build_object(
      'timezone', 'Africa/Lagos',
      'days', ARRAY['tue', 'thu', 'sat'],
      'notes', 'Available after 16:00 local time'
    ),
    'verified',
    v_creator,
    now() - interval '6 days',
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Resolve mentor row id (may already exist for this user from a prior seed/run)
  SELECT id INTO v_mentor1
  FROM public.youth_mentors
  WHERE user_id = v_mentor_user
  LIMIT 1;

  IF v_mentor1 IS NOT NULL THEN
    INSERT INTO public.youth_mentorship_matches (
      id, mentor_id, participant_id, program_id, status, goals,
      guardian_approval_status, started_at
    ) VALUES (
      v_match1,
      v_mentor1,
      v_participant,
      v_prog1,
      'active',
      jsonb_build_array(
        jsonb_build_object('title', 'Define community project goals', 'status', 'in_progress'),
        jsonb_build_object('title', 'Practice facilitation weekly', 'status', 'todo')
      ),
      CASE WHEN v_participant = v_creator THEN 'not_required' ELSE 'approved' END,
      now() - interval '2 days'
    )
    ON CONFLICT (mentor_id, participant_id) DO NOTHING;
  END IF;

  -- Projects + members + tasks
  INSERT INTO public.youth_projects (
    id, organization_id, program_id, title, description, objective,
    skills_required, max_participants, status, start_date, end_date, milestones,
    created_by, approved_by, approved_at
  ) VALUES
  (
    v_project1,
    v_org1,
    v_prog1,
    'Community Reading Circle',
    'Launch a weekend reading circle for younger students with youth facilitators.',
    'Host 4 reading sessions and collect feedback from participants.',
    ARRAY['facilitation', 'literacy support'],
    20,
    'active',
    CURRENT_DATE,
    CURRENT_DATE + 45,
    jsonb_build_array(
      jsonb_build_object('title', 'Recruit volunteers', 'done', true),
      jsonb_build_object('title', 'First session', 'done', false)
    ),
    v_creator,
    v_creator,
    now() - interval '2 days'
  ),
  (
    v_project2,
    v_org2,
    v_prog2,
    'Digital Literacy Pop-up',
    'Teach basic digital skills at a local community center.',
    'Train 30 learners on safe internet use and productivity tools.',
    ARRAY['teaching', 'digital literacy'],
    15,
    'approved',
    CURRENT_DATE + 7,
    CURRENT_DATE + 35,
    '[]'::jsonb,
    v_creator,
    v_creator,
    now() - interval '1 day'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.youth_project_members (
    id, project_id, user_id, role, status, joined_at
  ) VALUES
    (v_pmember1, v_project1, v_participant, 'participant', 'active', now() - interval '2 days')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO public.youth_project_members (project_id, user_id, role, status, joined_at)
  SELECT v_project1, v_creator, 'coordinator', 'active', now() - interval '2 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.youth_project_members
    WHERE project_id = v_project1 AND user_id = v_creator
  );

  INSERT INTO public.youth_project_members (project_id, user_id, role, status, joined_at)
  SELECT v_project2, v_third, 'volunteer', 'active', now() - interval '1 day'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.youth_project_members
    WHERE project_id = v_project2 AND user_id = v_third
  );

  INSERT INTO public.youth_project_tasks (
    id, project_id, assigned_to, title, description, priority, due_date, status, created_by
  ) VALUES
  (
    v_task1,
    v_project1,
    v_participant,
    'Prepare session agenda',
    'Draft a 60-minute agenda for the first reading circle.',
    'high',
    CURRENT_DATE + 5,
    'in_progress',
    v_creator
  ),
  (
    v_task2,
    v_project1,
    v_participant,
    'Collect book donations',
    'Coordinate with local partners for age-appropriate books.',
    'medium',
    CURRENT_DATE + 10,
    'todo',
    v_creator
  )
  ON CONFLICT (id) DO NOTHING;

  -- Events + attendance
  INSERT INTO public.youth_events (
    id, organization_id, program_id, project_id, title, description, event_type,
    start_at, end_at, format, location_region, access_info, capacity, status, created_by
  ) VALUES
  (
    v_event1,
    v_org1,
    v_prog1,
    v_project1,
    'Leadership Kickoff Workshop',
    'Orientation workshop covering program goals, safety guidelines, and project planning basics.',
    'workshop',
    now() + interval '5 days',
    now() + interval '5 days' + interval '2 hours',
    'hybrid',
    'Lagos',
    'Meeting link shared to enrolled participants 24h before start.',
    50,
    'scheduled',
    v_creator
  ),
  (
    v_event2,
    v_org2,
    v_prog2,
    NULL,
    'Climate Solutions Webinar',
    'Guest talk on youth-led climate innovation across Africa.',
    'webinar',
    now() + interval '9 days',
    now() + interval '9 days' + interval '90 minutes',
    'online',
    'Accra',
    'Online only — access details after registration.',
    100,
    'scheduled',
    v_creator
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.youth_event_attendance (
    id, event_id, user_id, attendance_status
  ) VALUES (
    v_attend1,
    v_event1,
    v_participant,
    'registered'
  )
  ON CONFLICT (event_id, user_id) DO NOTHING;

  INSERT INTO public.youth_event_attendance (event_id, user_id, attendance_status)
  SELECT v_event2, v_third, 'registered'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.youth_event_attendance
    WHERE event_id = v_event2 AND user_id = v_third
  );

  -- Achievements
  INSERT INTO public.youth_achievements (
    id, user_id, program_id, project_id, organization_id, achievement_type,
    title, description, skills, verification_status, verified_by, verified_at,
    certificate_url, badge_slug, created_by
  ) VALUES
  (
    v_ach1,
    v_participant,
    v_prog1,
    v_project1,
    v_org1,
    'project_contribution',
    'Community Reading Circle Contributor',
    'Helped prepare facilitation materials for the community reading project.',
    ARRAY['facilitation', 'community service'],
    'verified',
    v_creator,
    now() - interval '1 day',
    NULL,
    'community_contributor',
    v_creator
  ),
  (
    v_ach2,
    v_participant,
    v_prog1,
    NULL,
    v_org1,
    'skill',
    'Leadership Foundations',
    'Completed orientation modules for the Young Community Leaders Fellowship.',
    ARRAY['leadership'],
    'pending',
    NULL,
    NULL,
    NULL,
    'leadership_foundations',
    v_participant
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'youth_leadership_seed: seeded demo orgs/programs/projects/events/mentorship/achievements';
END $$;
