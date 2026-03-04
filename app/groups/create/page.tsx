'use client'

import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Globe, Lock, Plus, Minus, MapPin, Tag, Upload, X, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useGroups } from '@/shared/hooks/useGroups'
import { useImageUpload } from '@/shared/hooks/useImageUpload'
import toast from 'react-hot-toast'

const CreateGroupPage: React.FC = () => {
  const router = useRouter()
  const { user } = useAuth()
  const { createGroup } = useGroups()
  const { uploadImage } = useImageUpload()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'community' as const,
    is_public: true,
    max_members: 100,
    location: '',
    country: '',
    avatar_url: '',
    banner_url: '',
  })
  
  const [goals, setGoals] = useState<string[]>([''])
  const [tags, setTags] = useState<string[]>([''])
  const [rules, setRules] = useState<string[]>(['Be respectful to all members'])
  // const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [bannerPreview, setBannerPreview] = useState<string>('')

  const categories = [
    { value: 'community', label: 'Community', icon: '👥', color: 'bg-blue-100 text-blue-800' },
    { value: 'politics', label: 'Politics', icon: '🏛️', color: 'bg-red-100 text-red-800' },
    { value: 'culture', label: 'Culture', icon: '🎭', color: 'bg-green-100 text-green-800' },
    { value: 'education', label: 'Education', icon: '📚', color: 'bg-purple-100 text-purple-800' },
    { value: 'business', label: 'Business', icon: '💼', color: 'bg-orange-100 text-orange-800' },
    { value: 'activism', label: 'Activism', icon: '✊', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'development', label: 'Development', icon: '🏗️', color: 'bg-gray-100 text-gray-800' },
  ]

  const countries = [
    'DZA', 'AGO', 'BEN', 'BWA', 'BFA', 'BDI', 'CMR', 'CPV', 'CAF', 'TCD',
    'COM', 'COG', 'COD', 'CIV', 'DJI', 'EGY', 'GNQ', 'ERI', 'ETH', 'GAB',
    'GMB', 'GHA', 'GIN', 'GNB', 'KEN', 'LSO', 'LBR', 'LBY', 'MDG', 'MWI',
    'MLI', 'MRT', 'MUS', 'MAR', 'MOZ', 'NAM', 'NER', 'NGA', 'RWA', 'STP',
    'SEN', 'SYC', 'SLE', 'SOM', 'ZAF', 'SSD', 'SDN', 'SWZ', 'TZA', 'TGO',
    'TUN', 'UGA', 'ZMB', 'ZWE'
  ]

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleArrayChange = (
    array: string[], 
    setArray: React.Dispatch<React.SetStateAction<string[]>>, 
    index: number, 
    value: string
  ) => {
    const newArray = [...array]
    newArray[index] = value
    setArray(newArray)
  }

  const addArrayItem = (
    array: string[], 
    setArray: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setArray([...array, ''])
  }

  const removeArrayItem = (
    array: string[], 
    setArray: React.Dispatch<React.SetStateAction<string[]>>, 
    index: number
  ) => {
    if (array.length > 1) {
      setArray(array.filter((_, i) => i !== index))
    }
  }

  // const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0]
  //   if (!file) return

  //   if (!file.type.startsWith('image/')) {
  //     toast.error('Please select an image file')
  //     return
  //   }

  //   if (file.size > 5 * 1024 * 1024) {
  //     toast.error('Avatar must be less than 5MB')
  //     return
  //   }

  //   setUploadingAvatar(true)
  //   try {
  //     // Create preview
  //     const reader = new FileReader()
  //     reader.onload = (e) => {
  //       setAvatarPreview(e.target?.result as string)
  //     }
  //     reader.readAsDataURL(file)

  //     // Upload image
  //     const url = await uploadImage(file, 'groups')
  //     if (url) {
  //       setFormData(prev => ({ ...prev, avatar_url: url }))
  //       toast.success('Avatar uploaded successfully')
  //     }
  //   } catch (error) {
  //     toast.error('Failed to upload avatar')
  //   } finally {
  //     setUploadingAvatar(false)
  //   }
  // }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Banner must be less than 10MB')
      return
    }

    setUploadingBanner(true)
    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setBannerPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Upload image
      const url = await uploadImage(file, 'groups')
      if (url) {
        setFormData(prev => ({ ...prev, banner_url: url }))
        toast.success('Banner uploaded successfully')
      }
    } catch (error) {
      toast.error('Failed to upload banner')
    } finally {
      setUploadingBanner(false)
    }
  }

  // const removeAvatar = () => {
  //   setFormData(prev => ({ ...prev, avatar_url: '' }))
  //   setAvatarPreview('')
  // }

  const removeBanner = () => {
    setFormData(prev => ({ ...prev, banner_url: '' }))
    setBannerPreview('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current) return

    if (!user) {
      toast.error('You must be logged in to create a group')
      router.push('/signin')
      return
    }

    // Validation
    if (!formData.name.trim()) {
      toast.error('Group name is required')
      return
    }

    if (!formData.description.trim()) {
      toast.error('Group description is required')
      return
    }

    const filteredGoals = goals.filter(goal => goal.trim())
    if (filteredGoals.length === 0) {
      toast.error('At least one goal is required')
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const groupData = {
        ...formData,
        goals: filteredGoals,
        tags: tags.filter(tag => tag.trim()),
        rules: rules.filter(rule => rule.trim()),
      }

      const newGroup = await createGroup(groupData)
      
      toast.success('Group created successfully!')
      router.push(`/groups/${newGroup.id}`)
      
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">You must be logged in to create a group</p>
          <button onClick={() => router.push('/signin')} className="btn-primary">
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Create New Group</h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Avatar and Banner */}
          <div className="card space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Group Images</h3>
            
            {/* Banner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Banner Image (Optional)
              </label>
              <div className="relative">
                {bannerPreview || formData.banner_url ? (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200">
                    <img
                      src={bannerPreview || formData.banner_url}
                      alt="Banner preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeBanner}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                    <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Click to upload banner</span>
                    <span className="text-xs text-gray-500 mt-1">Recommended: 1200x400px</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      className="hidden"
                      disabled={uploadingBanner}
                    />
                  </label>
                )}
                {uploadingBanner && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Avatar */}
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Avatar Image (Optional)
              </label>
              <div className="flex items-center gap-4">
                {avatarPreview || formData.avatar_url ? (
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200">
                      <img
                        src={avatarPreview || formData.avatar_url}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-full cursor-pointer hover:border-primary-500 transition-colors">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                  </label>
                )}
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Upload a group avatar</p>
                  <p className="text-xs text-gray-500 mt-1">Recommended: 400x400px, square image</p>
                </div>
              </div>
            </div> */}
          </div>

          {/* Basic Info */}
          <div className="card space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            {/* Group Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="input-field"
                placeholder="Enter a descriptive name for your group"
                maxLength={100}
                required
              />
              <div className="text-right text-sm text-gray-500 mt-1">
                {formData.name.length}/100
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="input-field min-h-[100px] resize-none"
                placeholder="Describe what your group is about, its mission, and what members can expect"
                maxLength={1000}
                required
              />
              <div className="text-right text-sm text-gray-500 mt-1">
                {formData.description.length}/1000
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Category *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map(({ value, label, icon, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleInputChange('category', value)}
                    className={`flex items-center space-x-2 p-2 rounded-lg border-2 transition-all duration-200 ${
                      formData.category === value
                        ? 'border-orange-400 bg-primary-200 text-orange-900'
                        : 'border-gray-200 bg-[#F3F4F6] text-gray-600 hover:border-orange-400 hover:text-orange-900 hover:bg-primary-200'
                    }`}
                  >
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Goals */}
          <div className="card space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Group Goals *</h3>
            <p className="text-sm text-gray-600">
              What does your group aim to achieve? List your main objectives.
            </p>
            
            {goals.map((goal, index) => (
              <div key={index} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => handleArrayChange(goals, setGoals, index, e.target.value)}
                  className="input-field flex-1"
                  placeholder={`Goal ${index + 1}`}
                  maxLength={200}
                />
                {goals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArrayItem(goals, setGoals, index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                )}
                {index === goals.length - 1 && (
                  <button
                    type="button"
                    onClick={() => addArrayItem(goals, setGoals)}
                    className="p-2 text-green-500 hover:bg-green-50 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Settings */}
          <div className="card space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Group Settings</h3>
            
            {/* Privacy */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Privacy
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="privacy"
                    checked={formData.is_public}
                    onChange={() => handleInputChange('is_public', true)}
                    className="text-primary-600"
                  />
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-medium">Public</div>
                    <div className="text-sm text-gray-500">Anyone can find and join this group</div>
                  </div>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="privacy"
                    checked={!formData.is_public}
                    onChange={() => handleInputChange('is_public', false)}
                    className="text-primary-600"
                  />
                  <Lock className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-medium">Private</div>
                    <div className="text-sm text-gray-500">Members must be invited to join</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Max Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Members
              </label>
              <select
                value={formData.max_members}
                onChange={(e) => handleInputChange('max_members', parseInt(e.target.value))}
                className="input-field"
              >
                <option value={50}>50 members</option>
                <option value={100}>100 members</option>
                <option value={250}>250 members</option>
                <option value={500}>500 members</option>
                <option value={1000}>1000 members</option>
                <option value={5000}>5000 members</option>
              </select>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location (Optional)
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="input-field"
                  placeholder="City, Region"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country (Optional)
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="input-field"
                >
                  <option value="">Select Country</option>
                  {countries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="card space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Tags (Optional)</h3>
            <p className="text-sm text-gray-600">
              Help people discover your group with relevant tags.
            </p>
            
            {tags.map((tag, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => handleArrayChange(tags, setTags, index, e.target.value)}
                  className="input-field flex-1"
                  placeholder={`Tag ${index + 1}`}
                  maxLength={50}
                />
                {tags.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArrayItem(tags, setTags, index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                )}
                {index === tags.length - 1 && (
                  <button
                    type="button"
                    onClick={() => addArrayItem(tags, setTags)}
                    className="p-2 text-green-500 hover:bg-green-50 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Rules */}
          <div className="card space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Group Rules</h3>
            <p className="text-sm text-gray-600">
              Set clear guidelines for group behavior and participation.
            </p>
            
            {rules.map((rule, index) => (
              <div key={index} className="flex items-start space-x-2">
                <span className="text-sm text-gray-500 mt-3 min-w-6">{index + 1}.</span>
                <input
                  type="text"
                  value={rule}
                  onChange={(e) => handleArrayChange(rules, setRules, index, e.target.value)}
                  className="input-field flex-1"
                  placeholder={`Rule ${index + 1}`}
                  maxLength={200}
                />
                {rules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeArrayItem(rules, setRules, index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded mt-1"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                )}
                {index === rules.length - 1 && (
                  <button
                    type="button"
                    onClick={() => addArrayItem(rules, setRules)}
                    className="p-2 text-green-500 hover:bg-green-50 rounded mt-1"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center space-x-2"
              disabled={isSubmitting || uploadingAvatar || uploadingBanner}
            >
              <Users className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating...' : 'Create Group'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateGroupPage

