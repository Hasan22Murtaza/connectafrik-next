import type { Metadata } from 'next'

export const indexFollowRobots: Metadata['robots'] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
  },
}

export const noIndexNoFollowRobots: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
}

export function isPublicPostVisibility(visibility: string | null | undefined): boolean {
  if (!visibility) return true
  return visibility === 'public' || visibility === 'everyone'
}

export function isIndexableGroup(input: { is_public?: boolean; is_active?: boolean }): boolean {
  return input.is_public === true && input.is_active !== false
}

export function isIndexableGroupPost(input: {
  is_deleted?: boolean
  is_hidden?: boolean | null
  moderation_status?: string | null
  group?: { is_public?: boolean; is_active?: boolean }
}): boolean {
  if (input.is_deleted) return false
  if (input.is_hidden) return false
  if (input.moderation_status && input.moderation_status !== 'approved') return false
  if (input.group && !isIndexableGroup(input.group)) return false
  return true
}

export function isIndexableMemory(input: { is_public?: boolean; is_deleted?: boolean }): boolean {
  if (input.is_deleted) return false
  return input.is_public === true
}
