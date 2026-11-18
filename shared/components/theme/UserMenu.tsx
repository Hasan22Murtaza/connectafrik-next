'use client'

import React from 'react'
import Link from 'next/link'
import { MessageSquare, Settings, User, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut } from '@/shared/icons'

type UserMenuProps = {
  isOpen: boolean
  onSignOut: () => void
  onClose?: () => void
}

const UserMenu: React.FC<UserMenuProps> = ({ isOpen, onSignOut, onClose }) => {
  const { user } = useAuth()

  return (
    <div
      className={`absolute right-0  w-56 bg-surface-elevated rounded-lg shadow-dropdown border border-border transition-all duration-200 ${
        isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
      }`}
    >
      {isOpen && (
        <div className="p-1.5">
          <Link
            href={user ? `/user/${user.id}` : '/signin'}
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-sm text-content rounded-md hover:bg-surface-hover transition-colors"
          >
            <User className="w-4 h-4" />
            <span>My Profile</span>
          </Link>

          

          <Link
            href="/family-circle"
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-sm text-content rounded-md hover:bg-surface-hover transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>Family Circle</span>
          </Link>
          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-sm text-content rounded-md hover:bg-surface-hover transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
          <Link
            href="/feedback"
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-sm text-content rounded-md hover:bg-surface-hover transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Feedback</span>
          </Link>

          <hr className="my-1 border-border" />

          <button
            type="button"
            onClick={onSignOut}
            className="w-full text-left px-4 py-2 text-sm rounded-md text-danger hover:bg-surface-hover flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default UserMenu
