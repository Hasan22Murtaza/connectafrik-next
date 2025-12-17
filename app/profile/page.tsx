'use client'

import React, { useState, useEffect } from 'react'
import { 
  User, Lock, Bell, Shield, Eye, 
  Globe, Users, Camera, Save,
  Trash2, AlertTriangle, Download, Settings
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { useFileUpload } from '@/shared/hooks/useFileUpload'
import { supabase } from '@/lib/supabase'
import NotificationManager from '@/shared/components/ui/NotificationManager'
import toast from 'react-hot-toast'

const ProfileSettings: React.FC = () => {
  const { user, signOut } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { uploadFile } = useFileUpload()
  
  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    username: '',
    full_name: '',
    bio: '',
    country: ''
  })

  // Privacy Settings State
  const [privacySettings, setPrivacySettings] = useState({
    profile_visibility: 'public', // public, friends, private
    post_visibility: 'public',
    allow_comments: 'everyone', // everyone, friends, none
    allow_follows: 'everyone',
    show_online_status: true,
    show_country: true,
    show_followers_count: true
  })

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    comment_notifications: true,
    like_notifications: true,
    follow_notifications: true,
    mention_notifications: true,
    post_updates: false,
    weekly_digest: true
  })

  // Security Settings State
  const [securitySettings, setSecuritySettings] = useState({
    two_factor_enabled: false,
    login_alerts: true,
    data_download_requested: false
  })

  const [activeTab, setActiveTab] = useState('profile')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showNotificationManager, setShowNotificationManager] = useState(false)

  const countries = [
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
    'Cameroon', 'Cape Verde', 'Central African Republic', 'Chad', 'Comoros',
    'Democratic Republic of Congo', 'Republic of Congo', 'Djibouti', 'Egypt',
    'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia',
    'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho',
    'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius',
    'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda',
    'São Tomé and Príncipe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia',
    'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia',
    'Uganda', 'Zambia', 'Zimbabwe'
  ]

  useEffect(() => {
    if (profile) {
      setProfileForm({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        country: (profile as any).country || ''
      })

      // Load privacy settings from database
      setPrivacySettings({
        profile_visibility: (profile as any).profile_visibility || 'public',
        post_visibility: (profile as any).post_visibility || 'public',
        allow_comments: (profile as any).allow_comments || 'everyone',
        allow_follows: 'everyone',
        show_online_status: (profile as any).show_online_status ?? true,
        show_country: (profile as any).show_country ?? true,
        show_followers_count: (profile as any).show_followers_count ?? true
      })

      // Load notification settings from database
      setNotificationSettings({
        email_notifications: (profile as any).email_notifications ?? true,
        push_notifications: (profile as any).push_notifications ?? true,
        comment_notifications: (profile as any).comment_notifications ?? true,
        like_notifications: (profile as any).like_notifications ?? true,
        follow_notifications: (profile as any).follow_notifications ?? true,
        mention_notifications: (profile as any).mention_notifications ?? true,
        post_updates: (profile as any).post_updates ?? false,
        weekly_digest: (profile as any).weekly_digest ?? true
      })

      // Load security settings from database
      setSecuritySettings({
        two_factor_enabled: (profile as any).two_factor_enabled ?? false,
        login_alerts: (profile as any).login_alerts ?? true,
        data_download_requested: false
      })
    }
  }, [profile])

  const handleProfileUpdate = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateProfile(profileForm)
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
      const { error } = await updateProfile(privacySettings as any)
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
      const { error } = await updateProfile(notificationSettings as any)
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
      } as any)
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
      // Note: In production, this would need to be handled by a server function
      // as deleting auth users requires admin privileges
      toast.error('Account deletion not implemented yet. Please contact support.')
    } catch (error) {
      toast.error('Failed to delete account')
    }
  }

  const handleDataDownload = async () => {
    try {
      // Export user data
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', user?.id)

      const { data: comments } = await supabase
        .from('comments')
        .select('*')
        .eq('author_id', user?.id)

      const userData = {
        profile: profile,
        posts: posts,
        comments: comments,
        exported_at: new Date().toISOString()
      }

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Sign In</h1>
          <p className="text-gray-600">You need to be signed in to view your profile settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-4">
              <nav className="space-y-2">
                {tabs.map(tab => {
                  const IconComponent = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors duration-200 ${
                        activeTab === tab.id
                          ? 'bg-primary-50 text-primary-700 border border-primary-200'
                          : 'text-gray-700 hover:bg-gray-50'
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

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                  <p className="text-gray-600">Update your profile details and avatar</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Avatar Section */}
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

                  {/* Profile Form */}
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Country
                      </label>
                      <select
                        value={profileForm.country}
                        onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                        className="input-field"
                      >
                        <option value="">Select Country</option>
                        {countries.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                        className="w-full px-4 py-3 border-0 focus:outline-none focus:ring-0 resize-none bg-transparent"
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

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Privacy Settings</h2>
                  <p className="text-gray-600">Control who can see your content and interact with you</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Profile Visibility */}
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
                              onChange={(e) => setPrivacySettings({ ...privacySettings, profile_visibility: e.target.value })}
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

                  {/* Post Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Post Settings</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Who can see your posts?
                        </label>
                        <select
                          value={privacySettings.post_visibility}
                          onChange={(e) => setPrivacySettings({ ...privacySettings, post_visibility: e.target.value })}
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
                          onChange={(e) => setPrivacySettings({ ...privacySettings, allow_comments: e.target.value })}
                          className="input-field"
                        >
                          <option value="everyone">Everyone</option>
                          <option value="friends">Friends Only</option>
                          <option value="none">No One</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Other Privacy Options */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Other Privacy Options</h3>
                    <div className="space-y-4">
                      {[
                        { key: 'show_online_status', label: 'Show when you\'re online' },
                        { key: 'show_country', label: 'Show your country on profile' },
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

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
                  <p className="text-gray-600">Choose what notifications you want to receive</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Push Notification Settings */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
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

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                {/* Account Security */}
                <div className="card">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Account Security</h2>
                    <p className="text-gray-600">Manage your account security settings</p>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
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

                      <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
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

                    <div className="flex justify-between items-center">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button className="btn-secondary w-full sm:w-auto">Change Password</button>
                        <button
                          onClick={signOut}
                          className="btn-secondary w-full sm:w-auto"
                        >
                          Sign Out All Devices
                        </button>
                      </div>
                      <button
                        onClick={handleSecurityUpdate}
                        disabled={isSaving}
                        className="btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 w-auto px-8 py-2.5 min-w-[180px] max-w-[280px]"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Data & Privacy */}
                <div className="card">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Data & Privacy</h2>
                    <p className="text-gray-600">Download your data or delete your account</p>
                  </div>

                  <div className="p-6 space-y-4">
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

      {/* Notification Manager Modal */}
      {showNotificationManager && (
        <NotificationManager onClose={() => setShowNotificationManager(false)} />
      )}
    </div>
  )
}

export default ProfileSettings

