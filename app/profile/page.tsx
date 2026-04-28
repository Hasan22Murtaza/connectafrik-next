'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { 
  User, Lock, Bell, Shield, Eye, EyeOff,
  Globe, Users, Camera, Save,
  Trash2, AlertTriangle, Download, Settings, Monitor, X
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import type { ProfileVisibilityLevel } from '@/shared/types'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { apiClient, ApiError } from '@/lib/api-client'
import NotificationManager from '@/shared/components/ui/NotificationManager'
import {
  buildClientSessionDeviceLabelAsync,
  getSessionIdFromAccessToken,
} from '@/shared/utils/sessionDeviceLabel'
import toast from 'react-hot-toast'
import { LocationSearch } from '@/shared/components/ui/LocationSearch'
import { profileLocationFromDb } from '@/shared/types/location'

type ListedAuthSession = {
  id: string
  device_label: string
  ip: string | null
  last_active_at: string
}

const ProfileSettings: React.FC = () => {
  const { user, session, signOut, signOutAllDevices } = useAuth()
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
    show_followers_count: true
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

  const [securitySettings, setSecuritySettings] = useState({
    two_factor_enabled: false,
    login_alerts: true,
    data_download_requested: false
  })

  const [activeTab, setActiveTab] = useState('profile')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showNotificationManager, setShowNotificationManager] = useState(false)
  const [authSessions, setAuthSessions] = useState<ListedAuthSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [showPwCurrent, setShowPwCurrent] = useState(false)
  const [showPwNew, setShowPwNew] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  const canChangePassword =
    Boolean(user?.email?.trim()) &&
    Boolean(user?.identities?.some((i) => i.provider === 'email'))

  const currentAuthSessionId = getSessionIdFromAccessToken(session?.access_token ?? null)

  const loadAuthSessions = useCallback(async () => {
    if (!user) return
    setSessionsLoading(true)
    try {
      if (typeof navigator !== 'undefined') {
        const deviceLabel = await buildClientSessionDeviceLabelAsync()
        await apiClient
          .post('/api/auth/sessions/heartbeat', {
            deviceLabel,
            userAgent: navigator.userAgent,
          })
          .catch(() => {})
      }
      const res = await apiClient.get<{ sessions: ListedAuthSession[]; count: number }>('/api/auth/sessions')
      setAuthSessions(res.sessions)
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : 'Could not load active sessions.'
      toast.error(msg)
      setAuthSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (activeTab === 'security' && user) {
      void loadAuthSessions()
    }
  }, [activeTab, user, loadAuthSessions])

  const handleRevokeAuthSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId)
    try {
      await apiClient.delete(`/api/auth/sessions/${sessionId}`)
      toast.success('That device has been signed out.')
      if (sessionId === currentAuthSessionId) {
        await signOut()
      } else {
        await loadAuthSessions()
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not sign out that device.'
      toast.error(msg)
    } finally {
      setRevokingSessionId(null)
    }
  }

  useEffect(() => {
    if (!showChangePasswordModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPwCurrent(false)
        setShowPwNew(false)
        setShowPwConfirm(false)
        setShowChangePasswordModal(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showChangePasswordModal])

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('New passwords do not match.')
      return
    }
    if (passwordForm.next.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    setPasswordBusy(true)
    try {
      await apiClient.post<{ updated: boolean }>('/api/auth/change-password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      })
      toast.success('Password updated successfully.')
      setPasswordForm({ current: '', next: '', confirm: '' })
      setShowPwCurrent(false)
      setShowPwNew(false)
      setShowPwConfirm(false)
      setShowChangePasswordModal(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change password.')
    } finally {
      setPasswordBusy(false)
    }
  }

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
        show_followers_count: profile.show_followers_count ?? true
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

      setSecuritySettings({
        two_factor_enabled: profile.two_factor_enabled ?? false,
        login_alerts: profile.login_alerts ?? true,
        data_download_requested: profile.data_download_requested ?? false
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

  const handleSecurityUpdate = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateProfile({
        two_factor_enabled: securitySettings.two_factor_enabled,
        login_alerts: securitySettings.login_alerts
      })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Security settings updated successfully!')
      }
    } catch (error) {
      toast.error('Failed to update security settings')
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

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return
    }

    const confirmation = prompt('Type "DELETE" to confirm account deletion:')
    if (confirmation !== 'DELETE') {
      toast.error('Account deletion cancelled')
      return
    }

    try {
      toast.error('Account deletion not implemented yet. Please contact support.')
    } catch (error) {
      toast.error('Failed to delete account')
    }
  }

  const handleDataDownload = async () => {
    try {
      const res = await apiClient.get<{ data: any }>('/api/users/me/export')
      const userData = res?.data ?? {}

      const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `connectafrik-data-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('Data exported successfully!')
    } catch (error) {
      toast.error('Failed to export data')
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock }
  ]

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Sign In</h1>
          <p className="text-gray-600">You need to be signed in to view your profile settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 sm:gap-6 gap-4">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4">
              <nav className=" md:flex-col flex gap-2 sm:gap-3  items-center overflow-x-auto  scrollbar-hide ">
                {tabs.map(tab => {
                  const IconComponent = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full rounded-full border flex items-center sm:space-x-3 space-x-1 px-3 py-2 rounded-lg text-left transition-colors duration-200 ${
                        activeTab === tab.id
                          ? ' bg-primary-600 text-white'
                          : ' hover:bg-gray-50 border-gray-200 bg-[#F3F4F6] text-gray-600  hover:text-white hover:bg-primary-600'
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          <div className="lg:col-span-3">
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4">
                <div className="sm:p-6 p-4  border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                  <p className="text-gray-600">Update your profile details and avatar</p>
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
                        <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center">
                          <User className="w-8 h-8 text-gray-600" />
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
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG or WebP. Max 5MB.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="[&_p]:text-gray-500"
                        fieldClassName="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 resize-none bg-transparent"
                        rows={4}
                        placeholder="Tell us about yourself..."
                        maxLength={500}
                      />
                      <div className="text-right text-sm text-gray-500 mt-1">
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
              <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4">
                <div className="sm:p-6 p-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Privacy Settings</h2>
                  <p className="text-gray-600">Control who can see your content and interact with you</p>
                </div>

                <div className="sm:p-6 py-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Visibility</h3>
                    <div className="space-y-4">
                      {[
                        { value: 'public', label: 'Public', desc: 'Anyone can see your profile', icon: Globe },
                        { value: 'friends', label: 'Friends Only', desc: 'Only people you follow and who follow you', icon: Users },
                        { value: 'private', label: 'Private', desc: 'Only you can see your profile', icon: Eye }
                      ].map(option => {
                        const IconComponent = option.icon
                        return (
                          <label key={option.value} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="radio"
                              name="profile_visibility"
                              value={option.value}
                              checked={privacySettings.profile_visibility === option.value}
                              onChange={(e) => setPrivacySettings({ ...privacySettings, profile_visibility: e.target.value as ProfileVisibilityLevel })}
                              className="text-primary-600"
                            />
                            <IconComponent className="w-5 h-5 text-gray-600" />
                            <div>
                              <div className="font-medium text-gray-900">{option.label}</div>
                              <div className="text-sm text-gray-500">{option.desc}</div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Post Settings</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    <h3 className="text-lg font-medium text-gray-900 mb-4">What others can see on your profile</h3>
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
                        <label key={option.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <span className="text-gray-900">{option.label}</span>
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
              <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4">
                <div className="sm:p-6 p-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
                  <p className="text-gray-600">Choose what notifications you want to receive</p>
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
                        className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
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
                      <label key={option.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{option.label}</div>
                          <div className="text-sm text-gray-500">{option.desc}</div>
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

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4">
                  <div className="sm:p-6 p-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Account Security</h2>
                    <p className="text-gray-600">Manage your account security settings</p>
                  </div>

                  <div className="sm:p-6 py-6 space-y-6">
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className='max-w-[320px]'>
                          <div className="font-medium text-gray-900">Two-Factor Authentication</div>
                          <div className="text-sm text-gray-500">Add an extra layer of security to your account</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={securitySettings.two_factor_enabled}
                          onChange={(e) => setSecuritySettings({ 
                            ...securitySettings, 
                            two_factor_enabled: e.target.checked 
                          })}
                          className="text-primary-600"
                        />
                      </label>

                      <label className=" flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className='sm:max-w-full max-w-[240px]'>
                          <div className="font-medium text-gray-900">Login Alerts</div>
                          <div className="text-sm text-gray-500">Get notified when someone logs into your account</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={securitySettings.login_alerts}
                          onChange={(e) => setSecuritySettings({ 
                            ...securitySettings, 
                            login_alerts: e.target.checked 
                          })}
                          className="text-primary-600"
                        />
                      </label>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-start gap-3">
                        <Monitor className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" aria-hidden />
                        <div>
                          <h3 className="font-medium text-gray-900">Where you&apos;re logged in</h3>
                          <p className="text-sm text-gray-500">
                            {sessionsLoading
                              ? 'Loading sessions…'
                              : `${authSessions.length} active ${authSessions.length === 1 ? 'session' : 'sessions'}`}
                          </p>
                        </div>
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {sessionsLoading && authSessions.length === 0 ? (
                          <li className="p-4 text-sm text-gray-500">Loading sessions…</li>
                        ) : authSessions.length === 0 ? (
                          <li className="p-4 text-sm text-gray-500">No active sessions found.</li>
                        ) : (
                          authSessions.map((s) => {
                            const isCurrent = currentAuthSessionId === s.id
                            let lastActiveLabel = ''
                            try {
                              lastActiveLabel = formatDistanceToNow(new Date(s.last_active_at), {
                                addSuffix: true,
                              })
                            } catch {
                              lastActiveLabel = ''
                            }
                            return (
                              <li
                                key={s.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate">{s.device_label}</div>
                                  <div className="text-sm text-gray-500 mt-0.5">
                                    {s.ip ? `IP ${s.ip} · ` : ''}
                                    {lastActiveLabel ? `Active ${lastActiveLabel}` : null}
                                  </div>
                                  {isCurrent ? (
                                    <span className="inline-block mt-1 text-xs font-medium text-orange-600">
                                      This device
                                    </span>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  disabled={revokingSessionId === s.id}
                                  onClick={() => handleRevokeAuthSession(s.id)}
                                  className="btn-secondary text-sm px-4 py-2 shrink-0 disabled:opacity-50"
                                >
                                  {revokingSessionId === s.id ? 'Signing out…' : 'Log out'}
                                </button>
                              </li>
                            )
                          })
                        )}
                      </ul>
                    </div>

                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <div className="flex  gap-4">
                        <button
                          type="button"
                          disabled={!canChangePassword}
                          title={
                            canChangePassword
                              ? undefined
                              : 'Only available when you signed up with email and password.'
                          }
                          onClick={() => {
                            if (!canChangePassword) {
                              toast.error(
                                'Password change is only for accounts that use email sign-in.'
                              )
                              return
                            }
                            setShowChangePasswordModal(true)
                          }}
                          className="btn-secondary w-full sm:w-auto disabled:opacity-50"
                        >
                          Change Password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              typeof window !== 'undefined' &&
                              !window.confirm(
                                'Sign out on every device? You will need to sign in again on each one.'
                              )
                            ) {
                              return
                            }
                            void signOutAllDevices()
                          }}
                          className="btn-secondary w-full sm:w-auto"
                        >
                          Sign Out All Devices
                        </button>
                      </div>
                      <button
                        onClick={handleSecurityUpdate}
                        disabled={isSaving}
                        className="btn-primary flex-1  flex items-center justify-center space-x-2 disabled:opacity-50 w-auto px-8 py-2.5  sm:max-w-[280px] max-w-full "
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(72,187,120,0.04)] p-4">
                  <div className="sm:p-6 p-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Data & Privacy</h2>
                    <p className="text-gray-600">Download your data or delete your account</p>
                  </div>

                  <div className="sm:p-6 pt-6 space-y-4">
                    <div className="sm:flex-row flex gap-4  flex-col">
                    <button
                      onClick={handleDataDownload}
                      className="w-full flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      <Download className="w-5 h-5" />
                      <span>Download My Data</span>
                    </button>

                    <button
                      onClick={handleDeleteAccount}
                      className="w-full flex items-center justify-center space-x-2 p-4 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors duration-200"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span>Delete Account</span>
                    </button>
                    </div>

                    <div className="text-sm text-gray-500 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                        <div>
                          <strong>Warning:</strong> Deleting your account will permanently remove all your posts, comments, and personal data. This action cannot be undone.
                        </div>
                      </div>
                    </div>
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

      {showChangePasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowPwCurrent(false)
              setShowPwNew(false)
              setShowPwConfirm(false)
              setShowChangePasswordModal(false)
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full border border-gray-200"
            role="dialog"
            aria-labelledby="change-password-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 id="change-password-title" className="text-lg font-semibold text-gray-900">
                Change password
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowPwCurrent(false)
                  setShowPwNew(false)
                  setShowPwConfirm(false)
                  setShowChangePasswordModal(false)
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePasswordSubmit} className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Enter your current password, then choose a new one (at least 8 characters).
              </p>
              <div>
                <label htmlFor="cp-current" className="block text-sm font-medium text-gray-700 mb-1">
                  Current password
                </label>
                <div className="relative">
                  <input
                    id="cp-current"
                    type={showPwCurrent ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwCurrent((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    aria-label={showPwCurrent ? 'Hide password' : 'Show password'}
                  >
                    {showPwCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="cp-new" className="block text-sm font-medium text-gray-700 mb-1">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="cp-new"
                    type={showPwNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwNew((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    aria-label={showPwNew ? 'Hide new password' : 'Show new password'}
                  >
                    {showPwNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="cp-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    id="cp-confirm"
                    type={showPwConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwConfirm((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    aria-label={showPwConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showPwConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPwCurrent(false)
                    setShowPwNew(false)
                    setShowPwConfirm(false)
                    setShowChangePasswordModal(false)
                  }}
                  className="btn-secondary px-4 py-2"
                  disabled={passwordBusy}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary px-4 py-2" disabled={passwordBusy}>
                  {passwordBusy ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileSettings

