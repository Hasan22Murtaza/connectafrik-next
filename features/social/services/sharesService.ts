import { supabase } from '@/lib/supabase'
import { notificationService } from '@/shared/services/notificationService'

export interface Share {
  id: string
  user_id: string
  post_id: string
  created_at: string
}

export const sharePost = async (postId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Check if user has already shared this post
    const { data: existingShare, error: checkError } = await supabase
      .from('shares')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw checkError
    }

    if (existingShare) {
      return { success: false, error: 'Post already shared' }
    }

    // Create the share
    const { error: shareError } = await supabase
      .from('shares')
      .insert({
        user_id: user.id,
        post_id: postId
      })

    if (shareError) {
      throw shareError
    }

    // Send push notification to post author (if not the current user)
    try {
      // Fetch post to get author_id and title
      const { data: postData } = await supabase
        .from('posts')
        .select('author_id, title, content')
        .eq('id', postId)
        .single()

      if (postData && postData.author_id !== user.id) {
        const actorName = user.user_metadata?.full_name || user.email || 'Someone'
        const postTitle = postData.title || postData.content?.substring(0, 50) || 'your post'
        await notificationService.sendPostInteractionNotification(
          postData.author_id,
          actorName,
          'share',
          postTitle
        )
      }
    } catch (notificationError) {
      // Don't fail the share if notification fails
    }

    // Also copy link to clipboard
    try {
      const url = `${process.env.NEXT_PUBLIC_APP_UR}/post/${postId}`
      await navigator.clipboard.writeText(url)
    } catch (clipboardError) {
      console.warn('Could not copy to clipboard:', clipboardError)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error sharing post:', error)
    return { success: false, error: error.message || 'Failed to share post' }
  }
}

export const unsharePost = async (postId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Remove the share
    const { error } = await supabase
      .from('shares')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId)

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error unsharing post:', error)
    return { success: false, error: error.message || 'Failed to unshare post' }
  }
}

export const checkIfShared = async (postId: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return false
    }

    const { data, error } = await supabase
      .from('shares')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking share status:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('Error checking share status:', error)
    return false
  }
}
