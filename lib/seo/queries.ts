import { cache } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-server'
import type {
  PublicGroupPostSeo,
  PublicGroupSeo,
  PublicMemorySeo,
  PublicPostSeo,
} from './types'

function getSeoSupabase(): SupabaseClient {
  try {
    return createServiceClient()
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) {
      throw new Error('SEO queries require NEXT_PUBLIC_SUPABASE_URL and a Supabase key')
    }
    return createClient(url, anon)
  }
}

function mapGroup(row: Record<string, unknown>): PublicGroupSeo {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Group'),
    description: (row.description as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    banner_url: (row.banner_url as string | null) ?? null,
    is_public: Boolean(row.is_public),
    is_active: row.is_active !== false,
    location: (row.location as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: (row.updated_at as string | null) ?? null,
  }
}

function mapAuthor(raw: unknown): PublicPostSeo['author'] {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  return {
    username: (a.username as string | null) ?? null,
    full_name: (a.full_name as string | null) ?? null,
    avatar_url: (a.avatar_url as string | null) ?? null,
    post_visibility: (a.post_visibility as string | null) ?? null,
  }
}

function mapMemoryAuthor(raw: unknown): PublicMemorySeo['author'] {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  return {
    username: (a.username as string | null) ?? null,
    full_name: (a.full_name as string | null) ?? null,
    avatar_url: (a.avatar_url as string | null) ?? null,
  }
}

export const getPostSeoData = cache(async (id: string): Promise<PublicPostSeo | null> => {
  try {
    const supabase = getSeoSupabase()
    const { data, error } = await supabase
      .from('posts')
      .select(
        `
        id, content, category, tags, media_urls, media_type, created_at, updated_at, author_id,
        author:profiles!posts_author_id_fkey(username, full_name, avatar_url, post_visibility)
      `
      )
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error || !data) return null
    return {
      id: data.id,
      content: data.content ?? '',
      category: data.category ?? null,
      tags: data.tags ?? null,
      media_urls: data.media_urls ?? null,
      media_type: data.media_type ?? null,
      created_at: data.created_at,
      updated_at: data.updated_at ?? null,
      author_id: data.author_id,
      author: mapAuthor(data.author),
    }
  } catch (error) {
    console.error('SEO post query failed:', error)
    return null
  }
})

export const getGroupSeoData = cache(async (id: string): Promise<PublicGroupSeo | null> => {
  try {
    const supabase = getSeoSupabase()
    const { data, error } = await supabase
      .from('groups')
      .select(
        'id, name, description, category, tags, avatar_url, banner_url, is_public, is_active, location, created_at, updated_at'
      )
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !data) return null
    return mapGroup(data)
  } catch (error) {
    console.error('SEO group query failed:', error)
    return null
  }
})

export const getGroupPostSeoData = cache(
  async (groupId: string, postId: string): Promise<PublicGroupPostSeo | null> => {
    try {
      const supabase = getSeoSupabase()
      const [{ data: post, error: postError }, group] = await Promise.all([
        supabase
          .from('group_posts')
          .select(
            'id, group_id, title, content, post_type, media_urls, created_at, updated_at, moderation_status, is_deleted, is_hidden, author_id'
          )
          .eq('id', postId)
          .eq('group_id', groupId)
          .eq('is_deleted', false)
          .maybeSingle(),
        getGroupSeoData(groupId),
      ])

      if (postError || !post || !group) return null

      let author: PublicGroupPostSeo['author'] = null
      if (post.author_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, full_name, avatar_url')
          .eq('id', post.author_id)
          .maybeSingle()
        author = mapMemoryAuthor(profile)
      }

      return {
        id: post.id,
        group_id: post.group_id,
        title: post.title ?? null,
        content: post.content ?? '',
        post_type: post.post_type ?? null,
        media_urls: post.media_urls ?? null,
        created_at: post.created_at,
        updated_at: post.updated_at ?? null,
        moderation_status: post.moderation_status ?? null,
        is_deleted: Boolean(post.is_deleted),
        is_hidden: post.is_hidden ?? false,
        author,
        group,
      }
    } catch (error) {
      console.error('SEO group post query failed:', error)
      return null
    }
  }
)

export const getMemorySeoData = cache(async (id: string): Promise<PublicMemorySeo | null> => {
  try {
    const supabase = getSeoSupabase()
    const { data, error } = await supabase
      .from('reels')
      .select(
        `
        id, title, description, video_url, thumbnail_url, duration, category, tags,
        is_public, is_deleted, created_at, updated_at,
        profiles:profiles!reels_author_id_fkey(username, full_name, avatar_url)
      `
      )
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error || !data) return null
    return {
      id: data.id,
      title: data.title ?? null,
      description: data.description ?? null,
      video_url: data.video_url,
      thumbnail_url: data.thumbnail_url ?? null,
      duration: data.duration ?? null,
      category: data.category ?? null,
      tags: data.tags ?? null,
      is_public: data.is_public !== false,
      created_at: data.created_at,
      updated_at: data.updated_at ?? null,
      author: mapMemoryAuthor(data.profiles),
    }
  } catch (error) {
    console.error('SEO memory query failed:', error)
    return null
  }
})

export async function countPublicPosts(): Promise<number> {
  const supabase = getSeoSupabase()
  // Over-count slightly so visibility filtering in listPublicPostsForSitemap cannot drop URLs off the last chunk.
  const { count } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
  return count ?? 0
}

export async function listPublicPostsForSitemap(offset: number, limit: number) {
  const supabase = getSeoSupabase()
  const { data, error } = await supabase
    .from('posts')
    .select(
      'id, created_at, updated_at, author:profiles!posts_author_id_fkey(post_visibility)'
    )
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error || !data) return []
  return data.filter((row) => {
    const vis = (row.author as { post_visibility?: string | null } | null)?.post_visibility
    return !vis || vis === 'public' || vis === 'everyone'
  })
}

export async function countPublicGroups(): Promise<number> {
  const supabase = getSeoSupabase()
  const { count } = await supabase
    .from('groups')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('is_public', true)
  return count ?? 0
}

export async function listPublicGroupsForSitemap(offset: number, limit: number) {
  const supabase = getSeoSupabase()
  const { data, error } = await supabase
    .from('groups')
    .select('id, created_at, updated_at')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error || !data) return []
  return data
}

export async function countPublicGroupPosts(): Promise<number> {
  const supabase = getSeoSupabase()
  const { count, error } = await supabase
    .from('group_posts')
    .select('id, groups!inner(is_public, is_active)', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .eq('is_hidden', false)
    .eq('moderation_status', 'approved')
    .eq('groups.is_public', true)
    .eq('groups.is_active', true)
  if (error) return 0
  return count ?? 0
}

export async function listPublicGroupPostsForSitemap(offset: number, limit: number) {
  const supabase = getSeoSupabase()
  const { data, error } = await supabase
    .from('group_posts')
    .select('id, group_id, created_at, updated_at, groups!inner(is_public, is_active)')
    .eq('is_deleted', false)
    .eq('is_hidden', false)
    .eq('moderation_status', 'approved')
    .eq('groups.is_public', true)
    .eq('groups.is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error || !data) return []
  return data
}

export async function countPublicMemories(): Promise<number> {
  const supabase = getSeoSupabase()
  const { count } = await supabase
    .from('reels')
    .select('id', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .eq('is_public', true)
  return count ?? 0
}

export async function listPublicMemoriesForSitemap(offset: number, limit: number) {
  const supabase = getSeoSupabase()
  const { data, error } = await supabase
    .from('reels')
    .select('id, created_at, updated_at')
    .eq('is_deleted', false)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error || !data) return []
  return data
}
