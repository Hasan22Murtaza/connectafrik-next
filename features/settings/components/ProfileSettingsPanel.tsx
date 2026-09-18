'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Loader2, User } from '@/shared/icons'
import { useProfile } from '@/shared/hooks/useProfile'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { LocationSearch } from '@/shared/components/ui/LocationSearch'
import { profileLocationFromDb } from '@/shared/types/location'
import toast from 'react-hot-toast'
import {
  SettingsCard,
  SettingsPanelSkeleton,
  SettingsSaveBar,
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
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<ProfileFormState>(emptyForm)
  const [saved, setSaved] = useState<ProfileFormState>(emptyForm)
  const [isUploading, setIsUploading] = useState(false)
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

    setIsUploading(true)
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
      setIsUploading(false)
    }
  }

  if (loading && !profile) return <SettingsPanelSkeleton />

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-col items-center gap-5 px-5 py-6 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="h-full w-full shrink-0 rounded-full object-cover ring-1 ring-border-subtle"
              />
            ) : (
              <div className="flex h-full w-full shrink-0 items-center justify-center rounded-full bg-surface-secondary ring-1 ring-border-subtle">
                <User className="h-10 w-10 text-content-tertiary" />
              </div>
            )}

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-surface bg-primary text-white shadow-sm transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
              aria-label="Change profile photo"
            >
              <Camera className="h-4 w-4" />
            </button>

            {isUploading ? (
              <div className="absolute inset-0 z-[5] flex items-center justify-center rounded-full bg-black/45">
                <Loader2 className="h-7 w-7 animate-spin text-white" />
              </div>
            ) : null}
          </div>
          <div className="w-full text-center sm:text-left">
            <div className="text-[17px] font-semibold text-content">
              {form.full_name || form.username || 'Your profile'}
            </div>
            {form.username ? (
              <p className="mt-0.5 text-sm text-content-secondary">@{form.username}</p>
            ) : null}
            <label className="btn-secondary mt-3 inline-flex min-h-11 cursor-pointer rounded-[14px] px-4">
              <Camera className="h-4 w-4" />
              <span>Change Avatar</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
            <p className="mt-2 text-xs text-content-tertiary">JPG, PNG or WebP. Max 5MB.</p>
          </div>
        </div>
      </div>

      <SettingsCard>
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
