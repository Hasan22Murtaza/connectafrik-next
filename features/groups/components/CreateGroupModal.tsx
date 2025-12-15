import React, { useState } from 'react'
import { X, Users, Globe, Lock, Plus, Minus, MapPin, Tag } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useGroups } from '@/shared/hooks/useGroups'
import toast from 'react-hot-toast'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (groupId: string) => void
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth()
  const { createGroup } = useGroups()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'community' as const,
    is_public: true,
    max_members: 100,
    location: '',
    country: '',
  })
  
  const [goals, setGoals] = useState<string[]>([''])
  const [tags, setTags] = useState<string[]>([''])
  const [rules, setRules] = useState<string[]>(['Be respectful to all members'])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

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

    setIsSubmitting(true)

    try {
      const groupData = {
        ...formData,
        goals: filteredGoals,
        tags: tags.filter(tag => tag.trim()),
        rules: rules.filter(rule => rule.trim()),
      }

      const newGroup = await createGroup(groupData)
      
      onSuccess?.(newGroup.id)
      onClose()
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        category: 'community',
        is_public: true,
        max_members: 100,
        location: '',
        country: '',
      })
      setGoals([''])
      setTags([''])
      setRules(['Be respectful to all members'])
      
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Group</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
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
                    className={`flex items-center space-x-2 p-3 rounded-lg border-2 transition-all duration-200 ${
                      formData.category === value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
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
          <div className="space-y-4">
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
          <div className="space-y-4">
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
          <div className="space-y-4">
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
          <div className="space-y-4">
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
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center space-x-2"
              disabled={isSubmitting}
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

export default CreateGroupModal