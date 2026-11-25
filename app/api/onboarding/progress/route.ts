import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import type {
  OnboardingModule,
  OnboardingProgressRow,
  OnboardingStatus,
} from '@/shared/onboarding/types'

const MODULES = new Set<OnboardingModule>(['gsch', 'youth_leadership'])
const STATUSES = new Set<OnboardingStatus>(['not_started', 'completed', 'skipped'])

function parseModule(value: string | null): OnboardingModule | null {
  if (!value || !MODULES.has(value as OnboardingModule)) return null
  return value as OnboardingModule
}

/** GET /api/onboarding/progress?module=gsch — fetch all progress rows for a module */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const module = parseModule(request.nextUrl.searchParams.get('module'))
    if (!module) {
      return errorResponse('Invalid or missing module', 400)
    }

    const { data, error } = await supabase
      .from('user_onboarding_progress')
      .select('id, user_id, module, screen_key, status, completed_at, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('module', module)

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse<OnboardingProgressRow[]>(data ?? [])
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load onboarding progress', 500)
  }
}

/**
 * PATCH /api/onboarding/progress
 * Body: { module, screen_key, status }
 * Upserts a single screen's completion / skip / reset.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = (await request.json()) as {
      module?: string
      screen_key?: string
      status?: string
    }

    const module = parseModule(body.module ?? null)
    const screenKey = typeof body.screen_key === 'string' ? body.screen_key.trim() : ''
    const status = body.status as OnboardingStatus | undefined

    if (!module || !screenKey || !status || !STATUSES.has(status)) {
      return errorResponse('Invalid module, screen_key, or status', 400)
    }

    const completedAt =
      status === 'completed' || status === 'skipped' ? new Date().toISOString() : null

    const { data, error } = await supabase
      .from('user_onboarding_progress')
      .upsert(
        {
          user_id: user.id,
          module,
          screen_key: screenKey,
          status,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,module,screen_key' }
      )
      .select('id, user_id, module, screen_key, status, completed_at, created_at, updated_at')
      .single()

    if (error) {
      return errorResponse(error.message, 500)
    }

    return jsonResponse<OnboardingProgressRow>(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update onboarding progress', 500)
  }
}
