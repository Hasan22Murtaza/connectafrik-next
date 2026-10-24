'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Image, Loader2, User, X } from '@/shared/icons'
import { useProfile } from '@/shared/hooks/useProfile'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { LocationSearch } from '@/shared/components/ui/LocationSearch'
import { profileLocationFromDb } from '@/shared/types/location'
import toast from 'react-hot-toast'
import {
  SettingsCard,
  SettingsPanelSkeleton,
  SettingsSaveBar,
  SettingsSectionHeader,
  settingsInputClass,
  settingsLabelClass,
} from './SettingsPrimitives'

type ProfileFormState = {
  username: string
  full_name: string
  bio: string
  formattedAddress: string
  address: string
  city: string
  state: string
  zipcode: string
  country: string
  birthday: string
}

const emptyForm: ProfileFormState = {
  username: '',
  full_name: '',
  bio: '',
  formattedAddress: '',
  address: '',
  city: '',
  state: '',
  zipcode: '',
  country: '',
  birthday: '',
}

export function ProfileSettingsPanel() {
  const { profile, loading, updateProfile } = useProfile()
  const { uploadFile } = useFileUpload()
  const avatarRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<ProfileFormState>(emptyForm)
  const [saved, setSaved] = useState<ProfileFormState>(emptyForm)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    const loc = profileLocationFromDb(profile)
    const next: ProfileFormState = {
      username: profile.username || '',
      full_name: profile.full_name || '',
      bio: profile.bio || '',
      formattedAddress: loc.formattedAddress,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zipcode: loc.zipcode,
      country: loc.country,
      birthday: profile.birthday || '',
    }
    setForm(next)
    setSaved(next)
  }, [profile])

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateProfile({
        username: form.username,
        full_name: form.full_name,
        bio: form.bio,
        address: form.address,
        city: form.city,
        state: form.state,
        zipcode: form.zipcode,
        country: form.country,
        birthday: form.birthday,
      })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Profile updated successfully!')
        setSaved(form)
      }
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setIsUploadingAvatar(true)
    try {
      const result = await uploadFile(file, {
        bucket: 'user-avatars',
        compress: true,
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.url) {
        await updateProfile({ avatar_url: result.url })
        toast.success('Profile picture updated!')
      }
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setIsUploadingBanner(true)
    try {
      const result = await uploadFile(file, {
        bucket: 'user-avatars',
        maxSize: 10 * 1024 * 1024,
        compress: true,
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.url) {
        await updateProfile({ banner_image: result.url })
        toast.success('Banner image updated!')
      }
    } catch {
      toast.error('Failed to upload banner')
    } finally {
      setIsUploadingBanner(false)
    }
  }

  const handleRemoveBanner = async () => {
    setIsUploadingBanner(true)
    try {
      const { error } = await updateProfile({ banner_image: null })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Banner image removed')
      }
    } catch {
      toast.error('Failed to remove banner')
    } finally {
      setIsUploadingBanner(false)
    }
  }

  if (loading && !profile) return <SettingsPanelSkeleton />

  const displayName = form.full_name || form.username || 'Your profile'

  return (
    <div className="space-y-4">
      <input
        ref={bannerRef}
        type="file"
        accept="image/*"
        onChange={handleBannerUpload}
        className="hidden"
        disabled={isUploadingBanner}
      />
      <input
        ref={avatarRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
        disabled={isUploadingAvatar}
      />

      {/* Profile preview — banner + avatar as one composition */}
      <SettingsCard className="overflow-hidden">
        <div className="relative">
          <div
            className={`group/banner relative h-36 overflow-hidden sm:h-44 ${
              profile?.banner_image
                ? 'bg-surface-secondary'
                : 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary-200)_55%,transparent),color-mix(in_srgb,var(--primary-50)_80%,var(--surface-secondary)),color-mix(in_srgb,var(--primary-100)_40%,transparent))]'
            }`}
          >
            {profile?.banner_image ? (
              <img
                src={profile.banner_image}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover/banner:scale-[1.02]"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
                <Image className="h-7 w-7 text-primary/50" aria-hidden />
                <span className="text-sm text-content-secondary">Add a banner to personalize your profile</span>
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10 opacity-0 transition-opacity duration-300 group-hover/banner:opacity-100" />

            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              {profile?.banner_image ? (
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  disabled={isUploadingBanner}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-content shadow-sm backdrop-blur-sm transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
                  aria-label="Remove banner image"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => bannerRef.current?.click()}
                disabled={isUploadingBanner}
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-surface/90 px-3.5 text-sm font-medium text-content shadow-sm backdrop-blur-sm transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{profile?.banner_image ? 'Edit cover' : 'Add cover'}</span>
              </button>
            </div>

            {isUploadingBanner ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
                <Loader2 className="h-7 w-7 animate-spin text-white" />
              </div>
            ) : null}
          </div>

          <div className="relative px-4 pb-5 pt-0 sm:px-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-4">
                <div className="-mt-12 relative h-[104px] w-[104px] shrink-0 sm:-mt-14 sm:h-[120px] sm:w-[120px]">
                  <div className="h-full w-full overflow-hidden rounded-full border-[4px] border-surface bg-surface-secondary shadow-sm">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <User className="h-10 w-10 text-content-tertiary" />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => avatarRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute bottom-1 right-1 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-surface bg-primary text-white shadow-sm transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
                    aria-label="Change profile photo"
                  >
                    <Camera className="h-4 w-4" />
                  </button>

                  {isUploadingAvatar ? (
                    <div className="absolute inset-0 z-[5] flex items-center justify-center rounded-full bg-black/45">
                      <Loader2 className="h-7 w-7 animate-spin text-white" />
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 pb-1 text-center sm:text-left">
                  <h3 className="truncate text-lg font-semibold tracking-tight text-content sm:text-xl">
                    {displayName}
                  </h3>
                  {form.username ? (
                    <p className="mt-0.5 text-sm text-content-secondary">@{form.username}</p>
                  ) : (
                    <p className="mt-0.5 text-sm text-content-tertiary">Choose a username below</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                disabled={isUploadingAvatar}
                className="btn-secondary mx-auto min-h-11 shrink-0 rounded-[14px] px-4 sm:mx-0"
              >
                <Camera className="h-4 w-4" />
                <span>Change photo</span>
              </button>
            </div>

          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <SettingsSectionHeader
          title="About you"
          description="This is how people find and recognize you on CribsTalk."
        />
        <div className="space-y-5 px-4 py-5 sm:px-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={settingsLabelClass} htmlFor="settings-username">
                Username
              </label>
              <input
                id="settings-username"
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className={settingsInputClass}
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className={settingsLabelClass} htmlFor="settings-fullname">
                Full Name
              </label>
              <input
                id="settings-fullname"
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className={settingsInputClass}
                placeholder="Enter full name"
              />
            </div>
            <div className="md:col-span-2">
              <LocationSearch
                label="Location"
                value={{
                  formattedAddress: form.formattedAddress,
                  address: form.address,
                  city: form.city,
                  state: form.state,
                  zipcode: form.zipcode,
                  country: form.country,
                }}
                onChange={(loc) =>
                  setForm((prev) => ({
                    ...prev,
                    formattedAddress: loc.formattedAddress,
                    address: loc.address,
                    city: loc.city,
                    state: loc.state,
                    zipcode: loc.zipcode,
                    country: loc.country,
                  }))
                }
                labelClassName={settingsLabelClass}
                fieldClassName={`${settingsInputClass} pl-10`}
              />
            </div>
            <div>
              <label className={settingsLabelClass} htmlFor="settings-birthday">
                Date of Birth
              </label>
              <input
                id="settings-birthday"
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                className={settingsInputClass}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="md:col-span-2">
              <label className={settingsLabelClass} htmlFor="settings-bio">
                Bio
              </label>
              <textarea
                id="settings-bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className={`${settingsInputClass} min-h-[120px] resize-none py-3`}
                rows={4}
                placeholder="Tell people a little about yourself"
                maxLength={500}
              />
              <div className="mt-1 text-right text-xs text-content-tertiary">{form.bio.length}/500</div>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsSaveBar dirty={dirty} saving={isSaving} onSave={handleSave} />
    </div>
  )
}
