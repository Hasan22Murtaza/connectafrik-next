import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type CreateFeedbackInput,
  type FeedbackRow,
  type FeedbackStats,
  type FeedbackStatus,
  type FeedbackType,
  type FeedbackWithUser,
  type ListFeedbackFilters,
  type UpdateFeedbackInput,
} from './types'

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i

export function isFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === 'string' && (FEEDBACK_TYPES as readonly string[]).includes(value)
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === 'string' && (FEEDBACK_STATUSES as readonly string[]).includes(value)
}

export function validateCreateFeedbackInput(input: CreateFeedbackInput): string | null {
  if (!isFeedbackType(input.feedback_type)) {
    return 'Invalid feedback type'
  }

  const title = input.title?.trim() ?? ''
  if (title.length < 3 || title.length > 200) {
    return 'Title must be between 3 and 200 characters'
  }

  const message = input.message?.trim() ?? ''
  if (message.length < 10 || message.length > 5000) {
    return 'Message must be between 10 and 5000 characters'
  }

  if (input.email) {
    const email = input.email.trim()
    if (!EMAIL_RE.test(email)) {
      return 'Please enter a valid email address'
    }
  }

  return null
}

export async function createFeedback(
  client: SupabaseClient,
  input: CreateFeedbackInput
): Promise<FeedbackRow> {
  const validationError = validateCreateFeedbackInput(input)
  if (validationError) {
    throw new Error(validationError)
  }

  const payload = {
    feedback_type: input.feedback_type,
    title: input.title.trim(),
    message: input.message.trim(),
    email: input.email?.trim() || null,
    user_name: input.user_name?.trim() || null,
    user_id: input.user_id || null,
    attachment_url: input.attachment_url || null,
    attachment_path: input.attachment_path || null,
    status: 'new' as const,
  }

  const { data, error } = await client
    .from('feedback')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to submit feedback')
  }

  return data as FeedbackRow
}

export async function getFeedbackStats(client: SupabaseClient): Promise<FeedbackStats> {
  const { data, error } = await client.from('feedback').select('status')

  if (error) {
    throw new Error(error.message || 'Failed to load feedback stats')
  }

  const stats: FeedbackStats = {
    total: 0,
    new: 0,
    under_review: 0,
    planned: 0,
    in_progress: 0,
    completed: 0,
    rejected: 0,
  }

  for (const row of data ?? []) {
    stats.total += 1
    const status = row.status as FeedbackStatus
    if (status === 'new') stats.new += 1
    else if (status === 'under_review') stats.under_review += 1
    else if (status === 'planned') stats.planned += 1
    else if (status === 'in_progress') stats.in_progress += 1
    else if (status === 'completed') stats.completed += 1
    else if (status === 'rejected') stats.rejected += 1
  }

  return stats
}

export async function listFeedback(
  client: SupabaseClient,
  filters: ListFeedbackFilters = {}
): Promise<{ items: FeedbackWithUser[]; total: number }> {
  const page = Math.max(0, filters.page ?? 0)
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20))
  const from = page * limit
  const to = from + limit - 1

  let query = client
    .from('feedback')
    .select(
      `
      *,
      profiles:user_id (
        id,
        full_name,
        username,
        avatar_url
      )
      `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status && filters.status !== 'all' && isFeedbackStatus(filters.status)) {
    query = query.eq('status', filters.status)
  }

  if (filters.type && filters.type !== 'all' && isFeedbackType(filters.type)) {
    query = query.eq('feedback_type', filters.type)
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from)
  }

  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to)
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, '\\$&')
    query = query.or(
      `title.ilike.%${term}%,message.ilike.%${term}%,email.ilike.%${term}%,user_name.ilike.%${term}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(error.message || 'Failed to list feedback')
  }

  return {
    items: (data ?? []) as FeedbackWithUser[],
    total: count ?? 0,
  }
}

export async function getFeedbackById(
  client: SupabaseClient,
  id: string
): Promise<FeedbackWithUser | null> {
  const { data, error } = await client
    .from('feedback')
    .select(
      `
      *,
      profiles:user_id (
        id,
        full_name,
        username,
        avatar_url
      )
      `
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load feedback')
  }

  return data as FeedbackWithUser | null
}

export async function updateFeedback(
  client: SupabaseClient,
  id: string,
  input: UpdateFeedbackInput
): Promise<FeedbackWithUser> {
  const updates: Record<string, unknown> = {}

  if (input.status !== undefined) {
    if (!isFeedbackStatus(input.status)) {
      throw new Error('Invalid feedback status')
    }
    updates.status = input.status
    if (input.status !== 'new') {
      updates.reviewed_at = new Date().toISOString()
      if (input.reviewed_by) {
        updates.reviewed_by = input.reviewed_by
      }
    }
  }

  if (input.internal_notes !== undefined) {
    updates.internal_notes = input.internal_notes
  }

  if (input.admin_response !== undefined) {
    updates.admin_response = input.admin_response
  }

  if (input.reviewed_by !== undefined && updates.reviewed_by === undefined) {
    updates.reviewed_by = input.reviewed_by
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('No updates provided')
  }

  const { data, error } = await client
    .from('feedback')
    .update(updates)
    .eq('id', id)
    .select(
      `
      *,
      profiles:user_id (
        id,
        full_name,
        username,
        avatar_url
      )
      `
    )
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update feedback')
  }

  return data as FeedbackWithUser
}

export async function deleteFeedback(client: SupabaseClient, id: string): Promise<FeedbackRow> {
  const existing = await getFeedbackById(client, id)
  if (!existing) {
    throw new Error('Feedback not found')
  }

  const { error } = await client.from('feedback').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete feedback')
  }

  return existing
}

export function emptyFeedbackStats(): FeedbackStats {
  return {
    total: 0,
    new: 0,
    under_review: 0,
    planned: 0,
    in_progress: 0,
    completed: 0,
    rejected: 0,
  }
}
