import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-server'
import type { NotificationType } from '@/shared/types/notifications'

export type NotificationSettings = {
  email_notifications: boolean
  push_notifications: boolean
  comment_notifications: boolean
  like_notifications: boolean
  follow_notifications: boolean
  message_notifications: boolean
  mention_notifications: boolean
  post_updates: boolean
}

export type NotificationPreferenceKey = Exclude<
  keyof NotificationSettings,
  'email_notifications' | 'push_notifications'
>

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_notifications: true,
  push_notifications: true,
  comment_notifications: true,
  like_notifications: true,
  follow_notifications: true,
  message_notifications: true,
  mention_notifications: true,
  post_updates: false,
}

export const NOTIFICATION_SETTINGS_SELECT = [
  'id',
  'email_notifications',
  'push_notifications',
  'comment_notifications',
  'like_notifications',
  'follow_notifications',
  'message_notifications',
  'mention_notifications',
  'post_updates',
].join(', ')

function serviceDb(client?: SupabaseClient): SupabaseClient {
  try {
    return createServiceClient()
  } catch {
    if (client) return client
    throw new Error('Notification preference checks require a Supabase client')
  }
}

export function normalizeNotificationSettings(
  row: Partial<NotificationSettings> | null | undefined
): NotificationSettings {
  return {
    email_notifications: row?.email_notifications ?? DEFAULT_NOTIFICATION_SETTINGS.email_notifications,
    push_notifications: row?.push_notifications ?? DEFAULT_NOTIFICATION_SETTINGS.push_notifications,
    comment_notifications: row?.comment_notifications ?? DEFAULT_NOTIFICATION_SETTINGS.comment_notifications,
    like_notifications: row?.like_notifications ?? DEFAULT_NOTIFICATION_SETTINGS.like_notifications,
    follow_notifications: row?.follow_notifications ?? DEFAULT_NOTIFICATION_SETTINGS.follow_notifications,
    message_notifications: row?.message_notifications ?? DEFAULT_NOTIFICATION_SETTINGS.message_notifications,
    mention_notifications: row?.mention_notifications ?? DEFAULT_NOTIFICATION_SETTINGS.mention_notifications,
    post_updates: row?.post_updates ?? DEFAULT_NOTIFICATION_SETTINGS.post_updates,
  }
}

function canonicalPreferenceType(type: string): string {
  const value = type.trim().toLowerCase()
  if (value === 'friend_request_confirmed') return 'friend_request_accepted'
  if (value === 'like') return 'post_like'
  if (value === 'comment' || value === 'comment_reply') return 'post_comment'
  if (value === 'comment_like' || value === 'comment_reaction') return 'post_comment_like'
  return value
}

/** Maps a notification event to a category toggle. Null means no category gate. */
export function preferenceForNotificationType(type: string | null | undefined): NotificationPreferenceKey | null {
  if (!type) return null
  switch (canonicalPreferenceType(type)) {
    case 'follow':
    case 'unfollow':
    case 'friend_request':
    case 'friend_request_accepted':
    case 'friend_request_declined':
      return 'follow_notifications'
    case 'chat_message':
      return 'message_notifications'
    case 'post_comment':
    case 'reel_comment':
      return 'comment_notifications'
    case 'post_like':
    case 'post_comment_like':
    case 'post_reaction':
    case 'reel_like':
    case 'reel_comment_like':
      return 'like_notifications'
    case 'mention':
      return 'mention_notifications'
    case 'post_create':
    case 'reel_create':
      return 'post_updates'
    default:
      return null
  }
}

export function allowsInAppNotification(
  settings: NotificationSettings,
  type: string | null | undefined
): boolean {
  const key = preferenceForNotificationType(type)
  if (!key) return true
  return settings[key]
}

export function allowsPushNotification(
  settings: NotificationSettings,
  type: string | null | undefined
): boolean {
  if (!settings.push_notifications) return false
  return allowsInAppNotification(settings, type)
}

export function allowsNotificationEmail(
  settings: NotificationSettings,
  type?: string | null
): boolean {
  if (!settings.email_notifications) return false
  if (!type) return true
  return allowsInAppNotification(settings, type)
}

export async function loadNotificationSettings(
  userId: string,
  client?: SupabaseClient
): Promise<NotificationSettings> {
  const map = await loadNotificationSettingsMap([userId], client)
  return map.get(userId) ?? DEFAULT_NOTIFICATION_SETTINGS
}

export async function loadNotificationSettingsMap(
  userIds: string[],
  client?: SupabaseClient
): Promise<Map<string, NotificationSettings>> {
  const result = new Map<string, NotificationSettings>()
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return result

  const db = serviceDb(client)
  const { data, error } = await db.from('profiles').select(NOTIFICATION_SETTINGS_SELECT).in('id', unique)
  if (error) {
    for (const id of unique) result.set(id, DEFAULT_NOTIFICATION_SETTINGS)
    return result
  }
  const found = new Set<string>()
  for (const row of data || []) {
    found.add(row.id)
    result.set(row.id, normalizeNotificationSettings(row))
  }
  for (const id of unique) {
    if (!found.has(id)) result.set(id, DEFAULT_NOTIFICATION_SETTINGS)
  }
  return result
}

export async function userAllowsInAppNotification(
  userId: string,
  type: string | NotificationType,
  client?: SupabaseClient
): Promise<boolean> {
  const settings = await loadNotificationSettings(userId, client)
  return allowsInAppNotification(settings, type)
}

export async function userAllowsNotificationEmail(
  userId: string,
  type?: string | null,
  client?: SupabaseClient
): Promise<boolean> {
  const settings = await loadNotificationSettings(userId, client)
  return allowsNotificationEmail(settings, type)
}
