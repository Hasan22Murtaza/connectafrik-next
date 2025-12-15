'use client'

import React, { useState, useEffect } from 'react'
import { Search, Filter, Plus, Users, Compass, BookOpen, ArrowLeft, Home } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useGroups } from '@/shared/hooks/useGroups'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useGroupChat } from '@/shared/hooks/useGroupChat'
import GroupCard from '@/features/groups/components/GroupCard'
import CreateGroupModal from '@/features/groups/components/CreateGroupModal'
import { Group } from '@/shared/types'
import toast from 'react-hot-toast'

const GroupsPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const { groups, loading, fetchGroups, fetchMyGroups } = useGroups()
  const { openGroupChat } = useGroupChat()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [view, setView] = useState<'discover' | 'my-groups'>('discover')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([])

  const categories = [
    { value: '', label: 'All Categories', icon: '🌍' },
    { value: 'community', label: 'Community', icon: '👥' },
    { value: 'politics', label: 'Politics', icon: '🏛️' },
    { value: 'culture', label: 'Culture', icon: '🎭' },
    { value: 'education', label: 'Education', icon: '📚' },
    { value: 'business', label: 'Business', icon: '💼' },
    { value: 'activism', label: 'Activism', icon: '✊' },
    { value: 'development', label: 'Development', icon: '🏗️' },
  ]

  // Filter groups based on search and category
  useEffect(() => {
    let filtered = groups

    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase()
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(lowercaseSearch) ||
        group.description.toLowerCase().includes(lowercaseSearch) ||
        group.tags.some(tag => tag.toLowerCase().includes(lowercaseSearch)) ||
        group.goals.some(goal => goal.toLowerCase().includes(lowercaseSearch))
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter(group => group.category === selectedCategory)
    }

    setFilteredGroups(filtered)
  }, [groups, searchTerm, selectedCategory])

  const handleViewChange = (newView: 'discover' | 'my-groups') => {
    setView(newView)
    if (newView === 'my-groups') {
      fetchMyGroups()
    } else {
      fetchGroups()
    }
  }

  const handleSearch = () => {
    fetchGroups({
      search: searchTerm,
      category: selectedCategory,
      limit: 50
    })
  }

  const handleCreateGroupSuccess = (groupId: string) => {
    // Refresh groups after creating a new one
    if (view === 'my-groups') {
      fetchMyGroups()
    } else {
      fetchGroups()
    }
  }

  const handleViewGroup = (groupId: string) => {
    // Find the group from the current list
    const group = groups.find(g => g.id === groupId)

    if (!group) {
      toast.error('Group not found')
      return
    }

    // Check if user is a member
    const isMember = group.membership?.status === 'active'

    if (isMember) {
      // If member, open group chat
      openGroupChat(groupId, group.name)
      toast.success(`Opening ${group.name} chat`)
    } else {
      // If not a member, show a message to join first
      toast('Join this group to access group chat and features', {
        icon: 'ℹ️',
        duration: 4000
      })
    }
  }

  const featuredGroups = groups.filter(group => group.is_verified || group.member_count > 100).slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 mt-16">
          {/* Back to Feed Button */}
          <Link
            href="/feed"
            className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <Home className="w-4 h-4" />
            <span className="font-medium">Back to Feed</span>
          </Link>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">African Community Groups</h1>
              <p className="text-gray-600 mt-1">
                Connect with like-minded people and achieve common goals together
              </p>
            </div>

            {user && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Group</span>
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center space-x-1 mb-6">
            <button
              onClick={() => handleViewChange('discover')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                view === 'discover'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Discover Groups</span>
            </button>
            
            {user && (
              <button
                onClick={() => handleViewChange('my-groups')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  view === 'my-groups'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>My Groups</span>
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search groups by name, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white min-w-[180px]"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.icon} {category.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSearch}
              className="btn-primary px-6"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {view === 'discover' && !searchTerm && !selectedCategory && (
          <>
            {/* Featured Groups */}
            {featuredGroups.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center space-x-2 mb-4">
                  <BookOpen className="w-5 h-5 text-primary-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Featured Groups</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredGroups.map(group => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      onViewGroup={handleViewGroup}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Category Quick Access */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Browse by Category</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {categories.slice(1).map(category => (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    className="flex flex-col items-center p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all duration-200 group overflow-hidden"
                  >
                    <span className="text-2xl mb-2 group-hover:scale-105 transition-transform overflow-hidden">
                      {category.icon}
                    </span>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600">
                      {category.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Groups Grid */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {view === 'my-groups' ? 'Your Groups' : 'All Groups'}
              {filteredGroups.length > 0 && (
                <span className="text-gray-500 font-normal ml-2">
                  ({filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''})
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredGroups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onViewGroup={handleViewGroup}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {view === 'my-groups' ? 'No groups joined yet' : 'No groups found'}
              </h3>
              <p className="text-gray-500 mb-4">
                {view === 'my-groups'
                  ? 'Join or create groups to connect with people who share your interests and goals.'
                  : searchTerm || selectedCategory
                    ? 'Try adjusting your search filters or browse all groups.'
                    : 'Be the first to create a group in this community!'
                }
              </p>
              {user && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                >
                  Create Your First Group
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateGroupSuccess}
      />
    </div>
  )
}

export default GroupsPage

