import type { SupabaseClient } from '@supabase/supabase-js'

type DeleteStep = {
  label: string
  run: () => PromiseLike<{ error: { message: string } | null }>
}
export async function deleteUserAccount(
  serviceClient: SupabaseClient,
  userId: string,
  options?: { email?: string | null }
): Promise<{ deleted: true; id: string }> {
  const errors: string[] = []

  const ignore = async (step: DeleteStep) => {
    const { error } = await step.run()
    if (error) errors.push(`${step.label}: ${error.message}`)
  }

  const delEq = (table: string, column: string, value: string = userId): DeleteStep => ({
    label: `delete ${table} by ${column}`,
    run: () => serviceClient.from(table).delete().eq(column, value),
  })

  const delOr = (table: string, filter: string): DeleteStep => ({
    label: `delete ${table} (${filter})`,
    run: () => serviceClient.from(table).delete().or(filter),
  })
  await ignore(delEq('fcm_tokens', 'user_id'))
  await ignore(delEq('auth_session_device_labels', 'user_id'))
  await ignore(delEq('user_chat_lock', 'user_id'))
  if (options?.email) {
    await ignore({
      label: 'delete auth_email_otps',
      run: () => serviceClient.from('auth_email_otps').delete().eq('email', options.email!),
    })
  }
  await ignore(delEq('notifications', 'user_id'))
  await ignore(delEq('user_events', 'user_id'))
  await ignore(delOr('friend_requests', `sender_id.eq.${userId},receiver_id.eq.${userId}`))
  await ignore(delOr('follows', `follower_id.eq.${userId},following_id.eq.${userId}`))
  await ignore(delEq('post_saves', 'user_id'))
  await ignore(delEq('post_reactions', 'user_id'))
  await ignore(delEq('likes', 'user_id'))
  await ignore(delEq('comment_reactions', 'user_id'))
  await ignore(delEq('shares', 'user_id'))
  await ignore(delEq('reel_likes', 'user_id'))
  await ignore(delEq('reel_saves', 'user_id'))
  await ignore(delEq('reel_reposts', 'user_id'))
  await ignore(delEq('reel_views', 'user_id'))
  await ignore(delEq('reel_comment_likes', 'user_id'))
  await ignore(delEq('story_views', 'user_id'))
  await ignore(delEq('story_reactions', 'user_id'))
  await ignore(delEq('story_replies', 'user_id'))
  await ignore(delEq('product_saves', 'user_id'))
  await ignore(delEq('group_post_shares', 'user_id'))
  await ignore(delEq('group_event_attendees', 'user_id'))
  await ignore(delEq('comment_likes', 'user_id'))
  await ignore(delEq('message_reads', 'user_id'))
  await ignore(delEq('message_reactions', 'user_id'))
  {
    const { data: posts } = await serviceClient.from('posts').select('id').eq('author_id', userId)
    const postIds = (posts ?? []).map((p: { id: string }) => p.id)
    if (postIds.length > 0) {
      await ignore({
        label: 'delete comments on own posts',
        run: () => serviceClient.from('comments').delete().in('post_id', postIds),
      })
      await ignore({
        label: 'delete likes on own posts',
        run: () => serviceClient.from('likes').delete().in('post_id', postIds),
      })
      await ignore({
        label: 'delete post_reactions on own posts',
        run: () => serviceClient.from('post_reactions').delete().in('post_id', postIds),
      })
      await ignore({
        label: 'delete post_saves on own posts',
        run: () => serviceClient.from('post_saves').delete().in('post_id', postIds),
      })
      await ignore({
        label: 'delete shares of own posts',
        run: () => serviceClient.from('shares').delete().in('post_id', postIds),
      })
      await ignore({
        label: 'delete post_reports on own posts',
        run: () => serviceClient.from('post_reports').delete().in('post_id', postIds),
      })
      await ignore({
        label: 'delete own posts',
        run: () => serviceClient.from('posts').delete().in('id', postIds),
      })
    }
  }
  await ignore({
    label: 'soft-delete remaining posts',
    run: () =>
      serviceClient
        .from('posts')
        .update({ is_deleted: true, content: '' })
        .eq('author_id', userId),
  })
  await ignore(delEq('comments', 'author_id'))
  await ignore({
    label: 'soft-delete remaining comments',
    run: () =>
      serviceClient
        .from('comments')
        .update({ is_deleted: true, content: '[deleted]' })
        .eq('author_id', userId),
  })
  {
    const { data: reels } = await serviceClient.from('reels').select('id').eq('author_id', userId)
    const reelIds = (reels ?? []).map((r: { id: string }) => r.id)
    if (reelIds.length > 0) {
      await ignore({
        label: 'delete reel_comments',
        run: () => serviceClient.from('reel_comments').delete().in('reel_id', reelIds),
      })
      await ignore({
        label: 'delete reel_likes on own reels',
        run: () => serviceClient.from('reel_likes').delete().in('reel_id', reelIds),
      })
      await ignore({
        label: 'delete reel_saves on own reels',
        run: () => serviceClient.from('reel_saves').delete().in('reel_id', reelIds),
      })
      await ignore({
        label: 'delete reel_reposts on own reels',
        run: () => serviceClient.from('reel_reposts').delete().in('reel_id', reelIds),
      })
      await ignore({
        label: 'delete reel_views on own reels',
        run: () => serviceClient.from('reel_views').delete().in('reel_id', reelIds),
      })
      await ignore({
        label: 'delete reel_shares on own reels',
        run: () => serviceClient.from('reel_shares').delete().in('reel_id', reelIds),
      })
      await ignore({
        label: 'delete reel_reactions on own reels',
        run: () => serviceClient.from('reel_reactions').delete().in('reel_id', reelIds),
      })
      await ignore({
        label: 'delete own reels',
        run: () => serviceClient.from('reels').delete().in('id', reelIds),
      })
    }
  }
  await ignore({
    label: 'soft-delete remaining reels',
    run: () => serviceClient.from('reels').update({ is_deleted: true }).eq('author_id', userId),
  })
  await ignore(delEq('reel_comments', 'user_id'))
  await ignore(delEq('reel_likes', 'user_id'))
  await ignore(delEq('reel_saves', 'user_id'))
  await ignore(delEq('reel_reposts', 'user_id'))
  await ignore(delEq('reel_shares', 'user_id'))
  await ignore(delEq('reel_views', 'user_id'))
  await ignore(delEq('reel_reactions', 'user_id'))
  await ignore(delEq('reel_comment_likes', 'user_id'))
  await ignore(delEq('stories', 'user_id'))
  await ignore({
    label: 'deactivate owned groups',
    run: () => serviceClient.from('groups').update({ is_active: false }).eq('creator_id', userId),
  })
  {
    const { data: groupPosts } = await serviceClient
      .from('group_posts')
      .select('id')
      .eq('author_id', userId)
    const groupPostIds = (groupPosts ?? []).map((p: { id: string }) => p.id)
    if (groupPostIds.length > 0) {
      await ignore({
        label: 'delete group_post_comments on own group posts',
        run: () => serviceClient.from('group_post_comments').delete().in('group_post_id', groupPostIds),
      })
      await ignore({
        label: 'delete group_post_reactions on own group posts',
        run: () =>
          serviceClient.from('group_post_reactions').delete().in('group_post_id', groupPostIds),
      })
      await ignore({
        label: 'delete own group_posts',
        run: () => serviceClient.from('group_posts').delete().in('id', groupPostIds),
      })
    }
  }
  await ignore({
    label: 'soft-delete remaining group_posts',
    run: () =>
      serviceClient.from('group_posts').update({ is_deleted: true }).eq('author_id', userId),
  })
  await ignore(delEq('group_post_comments', 'author_id'))
  await ignore(delEq('group_memberships', 'user_id'))
  await ignore(delEq('products', 'seller_id'))
  {
    const { data: parts } = await serviceClient
      .from('chat_participants')
      .select('thread_id')
      .eq('user_id', userId)
    const threadIds = (parts ?? []).map((p: { thread_id: string }) => p.thread_id)
    for (const threadId of threadIds) {
      await ignore({
        label: `delete_thread_for_user ${threadId}`,
        run: () =>
          serviceClient.rpc('delete_thread_for_user', {
            p_thread_id: threadId,
            p_user_id: userId,
          }),
      })
    }
  }
  await ignore({
    label: 'tombstone chat_messages',
    run: () =>
      serviceClient
        .from('chat_messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          content: '[deleted]',
        })
        .eq('sender_id', userId),
  })
  await ignore(delEq('chat_participants', 'user_id'))
  await ignore(delEq('chat_transcripts', 'generated_by'))
  await ignore(delEq('signal_message_envelopes', 'recipient_user_id'))
  await ignore(delEq('call_keys', 'user_id'))
  await ignore(delEq('crypto_one_time_keys', 'user_id'))
  await ignore(delEq('crypto_device_keys', 'user_id'))
  await ignore(delEq('device_prekeys', 'user_id'))
  await ignore(delEq('e2ee_envelopes', 'user_id'))
  await ignore(delEq('e2ee_key_backups', 'user_id'))
  await ignore(delEq('user_devices', 'user_id'))
  const { error: profileError } = await serviceClient.from('profiles').delete().eq('id', userId)
  if (profileError) {
    const { error: anonError } = await serviceClient
      .from('profiles')
      .update({
        username: `deleted_${userId.slice(0, 8)}`,
        full_name: 'Deleted User',
        bio: null,
        avatar_url: null,
        cover_url: null,
        phone_number: null,
        status: null,
      })
      .eq('id', userId)
    if (anonError) {
      throw new Error(
        `Could not remove profile (${profileError.message}). Anonymize failed: ${anonError.message}`
      )
    }
    errors.push(`profile hard-delete blocked: ${profileError.message}; anonymized instead`)
  }
  const { error: authError } = await serviceClient.auth.admin.deleteUser(userId)
  if (authError) {
    const { error: banError } = await serviceClient.auth.admin.updateUserById(userId, {
      ban_duration: '876000h', // ~100 years
    })
    if (banError) {
      const hint = errors.length ? ` Cleanup notes: ${errors.slice(0, 5).join('; ')}` : ''
      throw new Error(`${authError.message}${hint}`)
    }
    return { deleted: true as const, id: userId }
  }

  return { deleted: true as const, id: userId }
}
