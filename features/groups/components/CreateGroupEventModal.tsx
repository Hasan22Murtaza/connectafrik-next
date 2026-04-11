'use client'

import React, { useState } from 'react'
import { X, Calendar, MapPin, Users, Globe, Lock, Clock, Video, Building } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface CreateGroupEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (eventData: {
    title: string
    description: string
    event_type: 'meeting' | 'action' | 'workshop' | 'discussion' | 'social'
    start_time: string
    end_time?: string
    location?: string
    is_virtual: boolean
    max_attendees: number
    is_public: boolean
  }) => Promise<void>
}

const EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting', icon: Users, isEmoji: false },
  { value: 'action', label: 'Action', icon: '✊', isEmoji: true },
  { value: 'workshop', label: 'Workshop', icon: '📚', isEmoji: true },
  { value: 'discussion', label: 'Discussion', icon: '💬', isEmoji: true },
  { value: 'social', label: 'Social', icon: '🎉', isEmoji: true },
] as const

const CreateGroupEventModal: React.FC<CreateGroupEventModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'meeting' as const,
    start_time: '',
    end_time: '',
    location: '',
    is_virtual: true,
    max_attendees: 100,
    is_public: true
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Event title is required')
      return
    }

    if (formData.title.trim().length < 5) {
      toast.error('Title must be at least 5 characters')
      return
    }

    if (formData.title.trim().length > 200) {
      toast.error('Title must be less than 200 characters')
      return
    }

    if (!formData.description.trim()) {
      toast.error('Event description is required')
      return
    }

    if (formData.description.trim().length < 10) {
      toast.error('Description must be at least 10 characters')
      return
    }

    if (formData.description.trim().length > 2000) {
      toast.error('Description must be less than 2000 characters')
      return
    }

    if (!formData.start_time) {
      toast.error('Start time is required')
      return
    }

    if (formData.end_time && new Date(formData.end_time) <= new Date(formData.start_time)) {
      toast.error('End time must be after start time')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: formData.title.trim(),
        description: formData.description.trim(),
        event_type: formData.event_type,
        start_time: formData.start_time,
        end_time: formData.end_time || undefined,
        location: formData.location || undefined,
        is_virtual: formData.is_virtual,
        max_attendees: formData.max_attendees,
        is_public: formData.is_public
      })
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        event_type: 'meeting',
        start_time: '',
        end_time: '',
        location: '',
        is_virtual: true,
        max_attendees: 100,
        is_public: true
      })
      onClose()
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Event</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter event title"
              maxLength={200}
              required
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {formData.title.length}/200
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px] resize-none"
              placeholder="Describe your event..."
              maxLength={2000}
              required
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {formData.description.length}/2000
            </div>
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type *
            </label>
            <div className="grid grid-cols-5 gap-2">
              {EVENT_TYPES.map((type) => {
                const Icon = type.isEmoji ? null : type.icon
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleInputChange('event_type', type.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      formData.event_type === type.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {Icon ? (
                      <Icon className={`w-5 h-5 ${formData.event_type === type.value ? 'text-primary-600' : 'text-gray-500'}`} />
                    ) : (
                      <span className="text-2xl">{type.icon as string}</span>
                    )}
                    <span className={`text-xs ${formData.event_type === type.value ? 'text-primary-600 font-medium' : 'text-gray-600'}`}>
                      {type.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => handleInputChange('start_time', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => handleInputChange('end_time', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min={formData.start_time}
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={formData.is_virtual ? "Meeting link (Zoom, Google Meet, etc.)" : "Physical location"}
                disabled={formData.is_virtual && !formData.location}
              />
              <button
                type="button"
                onClick={() => handleInputChange('is_virtual', !formData.is_virtual)}
                className={`p-2 rounded-lg border-2 transition-colors ${
                  formData.is_virtual
                    ? 'border-primary-500 bg-primary-50 text-primary-600'
                    : 'border-gray-300 text-gray-600'
                }`}
                title={formData.is_virtual ? 'Virtual Event' : 'In-Person Event'}
              >
                {formData.is_virtual ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <Building className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.is_virtual ? 'Virtual event - add meeting link' : 'In-person event - add physical location'}
            </p>
          </div>

          {/* Max Attendees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Attendees
            </label>
            <input
              type="number"
              value={formData.max_attendees}
              onChange={(e) => handleInputChange('max_attendees', parseInt(e.target.value) || 100)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              min={1}
              max={10000}
            />
          </div>

          {/* Privacy */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Privacy
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
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
                  <div className="text-sm text-gray-500">Anyone can see and join</div>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
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
                  <div className="text-sm text-gray-500">Only group members can see</div>
                </div>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateGroupEventModal

