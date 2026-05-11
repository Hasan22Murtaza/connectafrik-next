import type { SupabaseClient } from '@supabase/supabase-js'
import { POST_SELECT, formatPostsForClient } from '@/app/api/posts/format-posts-response'

export const VIDEO_URL_RE = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)($|\?)/i

export function isVideoUrl(url: string): boolean {
  return VIDEO_URL_RE.test(url)
}

export async function fetchFormattedAuthorPosts(
  supabase: SupabaseClient,
  viewerId: string | null,
  ownerId: string,
  postRowLimit: number
) {
  const { data: postsData, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('author_id', ownerId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(0, Math.max(0, postRowLimit - 1))

  if (error) {
    throw new Error(error.message)
  }

  const posts = postsData || []
  return formatPostsForClient(supabase, viewerId, posts, { onlyAuthorId: ownerId })
}
