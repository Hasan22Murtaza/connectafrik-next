'use client'

import React, { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { 
  User, Bell, Shield, Globe, Users, Camera, Save, Eye, Settings
} from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import type { ProfileVisibilityLevel } from '@/shared/types'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import NotificationManager from '@/shared/components/ui/NotificationManager'
import toast from 'react-hot-toast'
import { LocationSearch } from '@/shared/components/ui/LocationSearch'
import { profileLocationFromDb } from '@/shared/types/location'

type ProfileTab = 'profile' | 'privacy' | 'notifications'

function parseProfileTab(raw: string | null): ProfileTab {
  if (raw === 'privacy' || raw === 'notifications') return raw
  return 'profile'
}

const ProfileSettings: React.FC = () => {
  const searchParams = useSearchParams()
  const activeTab = parseProfileTab(searchParams.get('tab'))
  const { user } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { uploadFile } = useFileUpload()
  
  const [profileForm, setProfileForm] = useState({
    username: '',
    full_name: '',
    bio: '',
    formattedAddress: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    country: '',
    birthday: ''
  })

  const [privacySettings, setPrivacySettings] = useState<{
    profile_visibility: ProfileVisibilityLevel
    post_visibility: ProfileVisibilityLevel
    allow_comments: ProfileVisibilityLevel
    allow_follows: ProfileVisibilityLevel
    allow_direct_messages: ProfileVisibilityLevel
    show_online_status: boolean
    show_last_seen: boolean
    show_location: boolean
    show_phone: boolean
    show_email: boolean
    show_followers: boolean
    show_following: boolean
    show_country: boolean
    show_followers_count: boolean
    is_record: boolean
    is_capture: boolean
  }>({
    profile_visibility: 'public',
    post_visibility: 'public',
    allow_comments: 'everyone',
    allow_follows: 'everyone',
    allow_direct_messages: 'everyone',
    show_online_status: true,
    show_last_seen: true,
    show_location: true,
    show_phone: false,
    show_email: false,
    show_followers: true,
    show_following: true,
    show_country: true,
    show_followers_count: true,
    is_record: true,
    is_capture: true
  })

  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    comment_notifications: true,
    like_notifications: true,
    follow_notifications: true,
    message_notifications: true,
    mention_notifications: true,
    post_updates: false,
    weekly_digest: true
  })

  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showNotificationManager, setShowNotificationManager] = useState(false)

  useEffect(() => {
    if (profile) {
      const loc = profileLocationFromDb(profile)
      setProfileForm({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        formattedAddress: loc.formattedAddress,
        address: loc.address,
        city: loc.city,
        state: loc.state,
        zipcode: loc.zipcode,
        country: loc.country,
        birthday: profile.birthday || ''
      })

      setPrivacySettings({
        profile_visibility: profile.profile_visibility || 'public',
        post_visibility: profile.post_visibility || 'public',
        allow_comments: profile.allow_comments || 'everyone',
        allow_follows: profile.allow_follows || 'everyone',
        allow_direct_messages: profile.allow_direct_messages || 'everyone',
        show_online_status: profile.show_online_status ?? true,
        show_last_seen: profile.show_last_seen ?? true,
        show_location: profile.show_location ?? true,
        show_phone: profile.show_phone ?? false,
        show_email: profile.show_email ?? false,
        show_followers: profile.show_followers ?? true,
        show_following: profile.show_following ?? true,
        show_country: profile.show_country ?? true,
        show_followers_count: profile.show_followers_count ?? true,
        is_record: profile.is_record ?? true,
        is_capture: profile.is_capture ?? true
      })

      setNotificationSettings({
        email_notifications: profile.email_notifications ?? true,
        push_notifications: profile.push_notifications ?? true,
        comment_notifications: profile.comment_notifications ?? true,
        like_notifications: profile.like_notifications ?? true,
        follow_notifications: profile.follow_notifications ?? true,
        message_notifications: profile.message_notifications ?? true,
        mention_notifications: profile.mention_notifications ?? true,
        post_updates: profile.post_updates ?? false,
        weekly_digest: profile.weekly_digest ?? true
      })
    }
  }, [profile])

  const handleProfileUpdate = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateProfile({
        username: profileForm.username,
        full_name: profileForm.full_name,
        bio: profileForm.bio,
        address: profileForm.address,
        city: profileForm.city,
        state: profileForm.state,
        zipcode: profileForm.zipcode,
        country: profileForm.country,
        birthday: profileForm.birthday,
      })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Profile updated successfully!')
      }
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrivacyUpdate = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateProfile(privacySettings)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Privacy settings updated successfully!')
      }
    } catch (error) {
      toast.error('Failed to update privacy settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleNotificationUpdate = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateProfile(notificationSettings)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Notification preferences updated successfully!')
      }
    } catch (error) {
      toast.error('Failed to update notification settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result = await uploadFile(file, {
        bucket: 'user-avatars',
        compress: true
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.url) {
        await updateProfile({ avatar_url: result.url })
        toast.success('Profile picture updated!')
      }
    } catch (error) {
      toast.error('Failed to upload avatar')
    } finally {
      setIsUploading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-content mb-4">Please Sign In</h1>
          <p className="text-content-secondary">You need to be signed in to view your profile settings.</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'privacy' as const, label: 'Privacy', icon: Shield },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ]

  return (
    <div className="min-h-screen ">
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-content">Profile</h1>
          <p className="text-content-secondary">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 sm:gap-6 gap-4">
          <div className="lg:col-span-1">
            <div className="bg-surface rounded-2xl shadow-card p-4">
              <nav className=" md:flex-col flex gap-2 sm:gap-3  items-center overflow-x-auto  scrollbar-hide ">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon
                  return (
                    <Link
                      key={tab.id}
                      href={tab.id === 'profile' ? '/profile' : `/profile?tab=${tab.id}`}
                      className={`w-full rounded-full border flex items-center sm:space-x-3 space-x-1 px-3 py-2 rounded-lg text-left transition-colors duration-200 ${
                        activeTab === tab.id
                          ? ' bg-primary-50 text-primary-600 border-primary-300'
                          : ' hover:bg-surface-hover border border-gray-100 bg-gray-50 text-gray-700  hover:bg-gray-50'
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                      <span className="font-medium">{tab.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>

          <div className="lg:col-span-3">
            {activeTab === 'profile' && (
              <div className="bg-surface rounded-2xl shadow-card p-4">
                <div className="sm:p-6 p-4  border-b border-border">
                  <h2 className="text-xl font-semibold text-content">Profile Information</h2>
                  <p className="text-content-secondary">Update your profile details and avatar</p>
                </div>

                <div className="sm:p-6 py-6 space-y-6">
                  <div className="flex items-center space-x-6">
                    <div className="relative">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="Profile"
                          className="w-20 h-20 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-surface-tertiary rounded-full flex items-center justify-center">
                          <User className="w-8 h-8 text-content-secondary" />
                        </div>
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="btn-secondary cursor-pointer flex items-center space-x-2">
                        <Camera className="w-4 h-4" />
                        <span>Change Avatar</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                      <p className="text-xs text-content-secondary mt-1">JPG, PNG or WebP. Max 5MB.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-content mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={profileForm.username}
                        onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                        className="input-field"
                        placeholder="Enter username"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-content mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={profileForm.full_name}
                        onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                        className="input-field"
                        placeholder="Enter full name"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <LocationSearch
                        label="Location"
                        value={{
                          formattedAddress: profileForm.formattedAddress,
                          address: profileForm.address,
                          city: profileForm.city,
                          state: profileForm.state,
                          zipcode: profileForm.zipcode,
                          country: profileForm.country,
                        }}
                        onChange={(loc) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            formattedAddress: loc.formattedAddress,
                            address: loc.address,
                            city: loc.city,
                            state: loc.state,
                            zipcode: loc.zipcode,
                            country: loc.country,
                          }))
                        }
                        className="[&_p]:text-content-secondary"
                        fieldClassName="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-content mb-2">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={profileForm.birthday}
                        onChange={(e) => setProfileForm({ ...profileForm, birthday: e.target.value })}
                        className="input-field"
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-content mb-2">
                        Bio
                      </label>
                      <textarea
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                        className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-0 resize-none bg-transparent"
                        rows={4}
                        placeholder="Tell us about yourself..."
                        maxLength={500}
                      />
                      <div className="text-right text-sm text-content-secondary mt-1">
                        {profileForm.bio.length}/500
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleProfileUpdate}
                      disabled={isSaving}
                      className="btn-primary flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="bg-surface rounded-2xl shadow-card p-4">
                <div className="sm:p-6 p-4 border-b border-border">
                  <h2 className="text-xl font-semibold text-content">Privacy Settings</h2>
                  <p className="text-content-secondary">Control who can see your content and interact with you</p>
                </div>

                <div className="sm:p-6 py-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-content mb-4">Profile Visibility</h3>
                    <div className="space-y-4">
                      {[
                        { value: 'public', label: 'Public', desc: 'Anyone can see your profile', icon: Globe },
                        { value: 'friends', label: 'Friends Only', desc: 'Only people you follow and who follow you', icon: Users },
                        { value: 'private', label: 'Private', desc: 'Only you can see your profile', icon: Eye }
                      ].map(option => {
                        const IconComponent = option.icon
                        return (
                          <label
                        key={option.value}
                        className="flex items-center justify-between gap-4 p-4 border border-border rounded-xl cursor-pointer bg-surface transition-all duration-200 hover:bg-surface-hover hover:border-primary-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-hover">
                            <IconComponent className="w-5 h-5 text-content-secondary" />
                          </div>

                          <div className="space-y-0.5">
                            <div className="font-medium text-content">
                              {option.label}
                            </div>

                            <div className="text-sm text-content-secondary">
                              {option.desc}
                            </div>
                          </div>
                        </div>

                        <input
                          type="radio"
                          name="profile_visibility"
                          value={option.value}
                          checked={privacySettings.profile_visibility === option.value}
                          onChange={(e) => setPrivacySettings({ ...privacySettings, profile_visibility: e.target.value as ProfileVisibilityLevel })}
                          className="w-5 h-5 text-primary-600 focus:ring-primary-500"
                        />
                      </label>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-content mb-4">Post Settings</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-content mb-2">
                          Who can see your posts?
                        </label>
                        <select
                          value={privacySettings.post_visibility}
                          onChange={(e) => setPrivacySettings({ ...privacySettings, post_visibility: e.target.value as ProfileVisibilityLevel })}
                          className="input-field"
                        >
                          <option value="public">Everyone</option>
                          <option value="friends">Friends Only</option>
                          <option value="private">Only Me</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-content mb-2">
                          Who can comment on your posts?
                        </label>
                        <select
                          value={privacySettings.allow_comments}
                          onChange={(e) => setPrivacySettings({ ...privacySettings, allow_comments: e.target.value as ProfileVisibilityLevel })}
                          className="input-field"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="friends">Friends Only</option>
                          <option value="none">No One</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-content mb-2">
                          Who can follow you?
                        </label>
                        <select
                          value={privacySettings.allow_follows}
                          onChange={(e) => setPrivacySettings({ ...privacySettings, allow_follows: e.target.value as ProfileVisibilityLevel })}
                          className="input-field"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="friends">Friends Only</option>
                          <option value="none">No One</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-content mb-2">
                          Who can send you direct messages?
                        </label>
                        <select
                          value={privacySettings.allow_direct_messages}
                          onChange={(e) => setPrivacySettings({ ...privacySettings, allow_direct_messages: e.target.value as ProfileVisibilityLevel })}
                          className="input-field"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="friends">Friends Only</option>
                          <option value="none">No One</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-content mb-4">What others can see on your profile</h3>
                    <div className="space-y-4">
                      {[
                        { key: 'show_online_status', label: 'Show when you\'re online' },
                        { key: 'show_last_seen', label: 'Show last seen' },
                        { key: 'show_country', label: 'Show your country on profile' },
                        { key: 'show_location', label: 'Show location' },
                        { key: 'show_phone', label: 'Show phone number' },
                        { key: 'show_email', label: 'Show email' },
                        { key: 'show_followers', label: 'Show followers list' },
                        { key: 'show_following', label: 'Show following list' },
                        { key: 'show_followers_count', label: 'Show followers count' }
                      ].map(option => (
                        <label key={option.key} className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <span className="text-content">{option.label}</span>
                          <input
                            type="checkbox"
                            checked={privacySettings[option.key as keyof typeof privacySettings] as boolean}
                            onChange={(e) => setPrivacySettings({ 
                              ...privacySettings, 
                              [option.key]: e.target.checked 
                            })}
                            className="text-primary-600"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-content mb-4">Chat privacy</h3>
                    <div className="space-y-4">
                      {[
                        { key: 'is_record', label: 'Allow others to record calls with you' },
                        { key: 'is_capture', label: 'Allow others to screenshot/capture your chats' }
                      ].map(option => (
                        <label key={option.key} className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <span className="text-content">{option.label}</span>
                          <input
                            type="checkbox"
                            checked={privacySettings[option.key as keyof typeof privacySettings] as boolean}
                            onChange={(e) => setPrivacySettings({
                              ...privacySettings,
                              [option.key]: e.target.checked
                            })}
                            className="text-primary-600"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handlePrivacyUpdate}
                      disabled={isSaving}
                      className="btn-primary flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-surface rounded-2xl shadow-card p-4">
                <div className="sm:p-6 p-4 border-b border-border">
                  <h2 className="text-xl font-semibold text-content">Notification Preferences</h2>
                  <p className="text-content-secondary">Choose what notifications you want to receive</p>
                </div>

                <div className="sm:p-6 py-6 space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex sm:items-center items-start justify-between">
                      <div>
                        <h3 className="font-medium text-blue-900">Mobile Push Notifications</h3>
                        <p className="text-sm text-blue-700">Get notifications on your phone for friend requests, messages, and calls</p>
                      </div>
                      <button
                        onClick={() => setShowNotificationManager(true)}
                        className="btn-primary flex gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Configure</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
                      { key: 'push_notifications', label: 'Push Notifications', desc: 'Receive push notifications in browser' },
                      { key: 'comment_notifications', label: 'Comments', desc: 'When someone comments on your posts' },
                      { key: 'like_notifications', label: 'Likes', desc: 'When someone likes your posts or comments' },
                      { key: 'follow_notifications', label: 'New Followers', desc: 'When someone follows you' },
                      { key: 'message_notifications', label: 'Direct Messages', desc: 'When someone sends you a message' },
                      { key: 'mention_notifications', label: 'Mentions', desc: 'When someone mentions you in a post' },
                      { key: 'post_updates', label: 'Post Updates', desc: 'Updates from people you follow' },
                      { key: 'weekly_digest', label: 'Weekly Digest', desc: 'Weekly summary of activity' }
                    ].map(option => (
                      <label key={option.key} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <div className="font-medium text-content">{option.label}</div>
                          <div className="text-sm text-content-secondary">{option.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={notificationSettings[option.key as keyof typeof notificationSettings]}
                          onChange={(e) => setNotificationSettings({ 
                            ...notificationSettings, 
                            [option.key]: e.target.checked 
                          })}
                          className="text-primary-600"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-end mt-6">
                    <button
                      onClick={handleNotificationUpdate}
                      disabled={isSaving}
                      className="btn-primary flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNotificationManager && (
        <NotificationManager onClose={() => setShowNotificationManager(false)} />
      )}
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProfileSettings />
    </Suspense>
  )
}
