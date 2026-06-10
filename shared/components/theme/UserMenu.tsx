'use client'

import React from 'react'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import DisplayModeMenu from './DisplayModeMenu'

type UserMenuProps = {
  isOpen: boolean
  onSignOut: () => void
  onClose?: () => void
}

const UserMenu: React.FC<UserMenuProps> = ({ isOpen, onSignOut, onClose }) => {
  return (
    <div
      className={`absolute right-0 mt-2 w-56 bg-surface-elevated rounded-lg shadow-dropdown border border-border transition-all duration-200 ${
        isOpen ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
      }`}
    >
      <div className="py-2">
        <Link
          href="/profile"
          onClick={onClose}
          className="block px-4 py-2 text-sm text-content hover:bg-surface-hover transition-colors"
        >
          My Profile
        </Link>
        <Link
          href="/profile"
          onClick={onClose}
          className="block px-4 py-2 text-sm text-content hover:bg-surface-hover transition-colors"
        >
          Settings
        </Link>

        <hr className="my-1 border-border" />

        <DisplayModeMenu onClose={onClose} />

        <hr className="my-1 border-border" />

        <button
          type="button"
          onClick={onSignOut}
          className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-surface-hover flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export default UserMenu
