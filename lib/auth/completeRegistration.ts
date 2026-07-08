import type { SupabaseClient } from '@supabase/supabase-js'
import { createAuthClient } from '@/app/api/auth/_shared'
import { sendWelcomeEmail } from '@/shared/services/emailService'
import type { SignupProfileMetadata } from './otpTypes'

type SessionTokens = {
  access_token: string
  refresh_token: string
}

export async function upsertUserProfile(
  serviceClient: SupabaseClient,
  userId: string,
  metadata: SignupProfileMetadata
) {
  const fullName = `${metadata.first_name} ${metadata.last_name}`.trim()

  const { error } = await serviceClient.from('profiles').upsert(
    {
      id: userId,
      username: metadata.username,
      first_name: metadata.first_name,
      last_name: metadata.last_name,
      full_name: fullName,
      birthday: metadata.birthday,
      gender: metadata.gender,
      address: metadata.address ?? null,
      city: metadata.city ?? null,
      state: metadata.state ?? null,
      zipcode: metadata.zipcode ?? null,
      country: metadata.country ?? null,
      phone_number: metadata.phone_number ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function signInAndBuildResponse(
  serviceClient: SupabaseClient,
  email: string,
  password: string
) {
  const supabase = createAuthClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session || !data.user) {
    throw new Error(error?.message || 'Failed to create session')
  }

  let profileAvatarUrl: string | null = null
  let platformRole: string | null = null

  try {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('avatar_url, platform_role')
      .eq('id', data.user.id)
      .maybeSingle()
    profileAvatarUrl = profile?.avatar_url || null
    platformRole = profile?.platform_role || null
  } catch {
    profileAvatarUrl = null
    platformRole = null
  }

  const avatarUrl =
    data.user.user_metadata?.avatar_url ||
    data.user.user_metadata?.picture ||
    data.user.user_metadata?.profile_image ||
    profileAvatarUrl ||
    null

  const user = {
    ...data.user,
    user_metadata: {
      ...(data.user.user_metadata || {}),
      avatar_url: avatarUrl,
    },
  }

  const session = {
    ...data.session,
    user: data.session.user
      ? {
          ...data.session.user,
          user_metadata: {
            ...(data.session.user.user_metadata || {}),
            avatar_url: avatarUrl,
          },
        }
      : data.session.user,
  }

  return { user, session, platform_role: platformRole }
}

export async function completeSignupRegistration(params: {
  serviceClient: SupabaseClient
  email: string
  password: string
  metadata: SignupProfileMetadata
}) {
  const { serviceClient, email, password, metadata } = params

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...metadata,
      is_phone_registration: false,
    },
  })

  if (createError || !created.user) {
    throw new Error(createError?.message || 'Failed to create account')
  }

  await upsertUserProfile(serviceClient, created.user.id, metadata)

  const signInResult = await signInAndBuildResponse(serviceClient, email, password)

  const userName = metadata.first_name || metadata.username
  sendWelcomeEmail(email, userName).catch(() => {})

  return signInResult
}

export async function completePasswordReset(params: {
  serviceClient: SupabaseClient
  userId: string
  email: string
  password: string
}) {
  const { serviceClient, userId, email, password } = params

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  })

  if (updateError) {
    throw new Error(updateError.message)
  }

  return signInAndBuildResponse(serviceClient, email, password)
}

export async function confirmUserEmail(
  serviceClient: SupabaseClient,
  userId: string
) {
  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    email_confirm: true,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export function toSessionTokens(session: {
  access_token: string
  refresh_token: string
}): SessionTokens {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  }
}
