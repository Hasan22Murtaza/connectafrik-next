import React from 'react'
import {
  Landmark,
  Theater,
  BookOpen,
  Briefcase,
  Users,
  Megaphone,
  Building2,
  Crown,
  Shield,
  UserCheck,
} from 'lucide-react'

export interface CategoryInfo {
  icon: React.ReactNode
  color: string
}

const getCategoryIcon = (category: string, size: string = 'w-4 h-4'): React.ReactNode => {
  switch (category) {
    case 'politics':
      return <Landmark className={size} />
    case 'culture':
      return <Theater className={size} />
    case 'education':
      return <BookOpen className={size} />
    case 'business':
      return <Briefcase className={size} />
    case 'community':
      return <Users className={size} />
    case 'activism':
      return <Megaphone className={size} />
    case 'development':
      return <Building2 className={size} />
    default:
      return <Users className={size} />
  }
}

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'politics':
      return 'bg-red-50 text-red-700'
    case 'culture':
      return 'bg-emerald-50 text-emerald-700'
    case 'education':
      return 'bg-blue-50 text-blue-700'
    case 'business':
      return 'bg-purple-50 text-purple-700'
    case 'community':
      return 'bg-orange-50 text-orange-700'
    case 'activism':
      return 'bg-yellow-50 text-yellow-700'
    case 'development':
      return 'bg-slate-100 text-slate-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export const getCategoryInfo = (category: string): CategoryInfo => {
  return {
    icon: getCategoryIcon(category, 'w-4 h-4'),
    color: getCategoryColor(category),
  }
}

// For larger icons (used in detail pages)
export const getCategoryInfoLarge = (category: string): CategoryInfo => {
  return {
    icon: getCategoryIcon(category, 'w-5 h-5'),
    color: getCategoryColor(category),
  }
}

// Get role icon for group memberships
export const getRoleIcon = (role?: string): React.ReactNode => {
  switch (role) {
    case 'admin':
      return <Crown className="w-4 h-4 text-yellow-500" />
    case 'moderator':
      return <Shield className="w-4 h-4 text-blue-500" />
    case 'member':
      return <UserCheck className="w-4 h-4 text-green-500" />
    default:
      return null
  }
}

