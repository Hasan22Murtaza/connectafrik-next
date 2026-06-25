import { apiClient } from '@/lib/api-client'
import { buildShareLink } from '@/lib/deeplink/links'

export interface Share {
  id: string
  user_id: string
  post_id: string
  created_at: string
}

export const sharePost = async (postId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await apiClient.post<{ success: boolean; error?: string }>(`/api/posts/${postId}/share`)

    // Also copy a deep link to clipboard (Universal / App Link that opens the
    // app when installed, otherwise the web page).
    try {
      const url = buildShareLink(`/post/${postId}`)
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard may not be available
    }

    return result
  } catch (error: any) {
    console.error('Error sharing post:', error)
    return { success: false, error: error.message || 'Failed to share post' }
  }
}

export const unsharePost = async (postId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    return await apiClient.delete<{ success: boolean; error?: string }>(`/api/posts/${postId}/share`)
  } catch (error: any) {
    console.error('Error unsharing post:', error)
    return { success: false, error: error.message || 'Failed to unshare post' }
  }
}

export const checkIfShared = async (postId: string): Promise<boolean> => {
  // This check can be done via the post detail API which returns share status.
  // For now, a simple try: if share endpoint returns 409, it's already shared.
  try {
    const result = await apiClient.post<{ success: boolean; error?: string }>(`/api/posts/${postId}/share`)
    // If it succeeded, we shared it — undo it since this was just a check
    if (result.success) {
      await apiClient.delete(`/api/posts/${postId}/share`)
      return false
    }
    return false
  } catch (error: any) {
    // 409 = already shared
    if (error.status === 409) return true
    return false
  }
}
