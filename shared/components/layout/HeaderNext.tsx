'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, LogOut, Search, Bell, MessageCircle, Phone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { useNotifications } from '@/shared/hooks/useNotifications'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import ChatDropdown from '@/features/chat/components/ChatDropdown'
import NotificationDropdown from '@/shared/components/ui/NotificationDropdown'

interface HeaderProps {
  searchTerm?: string
  onSearchTermChange?: (term: string) => void
}

const Header: React.FC<HeaderProps> = ({ searchTerm = '', onSearchTermChange }) => {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { profile } = useProfile()
  const { } = useProductionChat()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showInbox, setShowInbox] = useState(false)
  const [showCalls, setShowCalls] = useState(false)
  // TODO: Get threads from messaging service or realtime hook
  const unreadMessages = 0 // useMemo(() => threads.reduce((total: number, thread: any) => total + (thread.unread_count || 0), 0), [threads])

  const handleSignOut = async () => {
    try {
      console.log('Starting sign out process...')
      await signOut()
      console.log('Sign out successful, navigating to signin...')
      // Force a hard navigation to ensure clean state
      window.location.href = '/signin'
    } catch (error) {
      console.error('Sign out error:', error)
      alert('An error occurred during sign out. Please try again.')
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 xl:px-8 overflow-visible py-1">
        <div className="flex items-center h-14 sm:h-16">
          {/* Logo - Pinned to left */}
          <Link href="/" className="flex-shrink-0 ">
            {/* <LogoNext size="lg" /> */}
            <img src="/assets/images/logo_2.png" alt="" className="w-16" />
          </Link>

          {/* Search Bar - Hidden on mobile, visible on tablet+ */}
          <div className="hidden md:flex flex-1 max-w-lg mx-4 lg:mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search discussions, culture, politics..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]  focus:border-transparent"
                value={searchTerm}
                onChange={(e) =>
                  onSearchTermChange && onSearchTermChange(e.target.value)
                }
              />
            </div>
          </div>

          {/* Navigation and User Menu - Pinned to right */}
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 ml-auto">
            {user ? (
              <>
                {/* Navigation Links - Hidden on mobile, visible on desktop */}
                <nav className="hidden lg:flex items-center space-x-6">
                  <Link
                    href="/feed"
                    className="text-gray-700 hover:text-primary-600 font-medium"
                  >
                    Feed
                  </Link>
                  <Link
                    href="/memories"
                    className="text-gray-700 hover:text-primary-600 font-medium"
                  >
                    Reels
                  </Link>
                  <Link
                    href="/politics"
                    className="text-gray-700 hover:text-primary-600 font-medium"
                  >
                    Politics
                  </Link>
                  <Link
                    href="/culture"
                    className="text-gray-700 hover:text-primary-600 font-medium"
                  >
                    Culture
                  </Link>
                  <Link
                    href="/groups"
                    className="text-gray-700 hover:text-primary-600 font-medium"
                  >
                    Groups
                  </Link>
                  <Link
                    href="/profile"
                    className="text-gray-700 hover:text-primary-600 font-medium"
                  >
                    Profile
                  </Link>
                </nav>

                {/* Notifications & Messaging */}
                <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4  border-gray-200">
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        setShowInbox(false);
                        setShowCalls(false);
                      }}
                      className="relative p-1 sm:p-1.5 lg:p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                      {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      )}
                    </button>
                    <NotificationDropdown
                      isOpen={showNotifications}
                      onClose={() => setShowNotifications(false)}
                    />
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowInbox(!showInbox);
                        setShowNotifications(false);
                        setShowCalls(false);
                      }}
                      className="relative p-1 sm:p-1.5 lg:p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      )}
                    </button>
                    {showInbox && (
                      <ChatDropdown
                        mode="chat"
                        onClose={() => setShowInbox(false)}
                      />
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowCalls(!showCalls);
                        setShowNotifications(false);
                        setShowInbox(false);
                      }}
                      className="relative p-1 sm:p-1.5 lg:p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    {showCalls && (
                      <ChatDropdown
                        mode="call"
                        onClose={() => setShowCalls(false)}
                      />
                    )}
                  </div>
                </div>

                {/* User Menu */}
                <div className="relative group ml-1 sm:ml-2 lg:ml-4 pl-1 sm:pl-2 lg:pl-4 border-l border-gray-200">
                  <button className="flex items-center space-x-1 sm:space-x-2 p-1 sm:p-1.5 lg:p-2 rounded-lg hover:bg-gray-50">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <User className="w-3 h-3 sm:w-3 sm:h-3 lg:w-4 lg:h-4 text-gray-600" />
                      </div>
                    )}
                    <span className="hidden md:block text-sm font-medium text-gray-700">
                      {profile?.username || "User"}
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="py-2">
                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        My Profile
                      </Link>
                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Settings
                      </Link>
                      <hr className="my-1" />
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4 pr-4 border-r border-gray-200">
                <Link href="/signin" className="btn-secondary">
                  Sign In
                </Link>
                <Link href="/signup" className="btn-primary">
                  Join Community
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {user && (
        <div className="md:hidden bg-white border-t border-gray-200 py-1 ">
          <nav className="flex justify-around py-2">
            <Link
              href="/feed"
              className="flex flex-col items-center py-2 text-gray-600 hover:text-primary-600"
            >
              <span className="text-xs">Feed</span>
            </Link>
            <Link
              href="/memories"
              className="flex flex-col items-center py-2 text-gray-600 hover:text-primary-600"
            >
              <span className="text-xs">Reels</span>
            </Link>
            <Link
              href="/culture"
              className="flex flex-col items-center py-2 text-gray-600 hover:text-primary-600"
            >
              <span className="text-xs">Culture</span>
            </Link>
            <Link
              href="/groups"
              className="flex flex-col items-center py-2 text-gray-600 hover:text-primary-600"
            >
              <span className="text-xs">Groups</span>
            </Link>
            <Link
              href="/profile"
              className="flex flex-col items-center py-2 text-gray-600 hover:text-primary-600"
            >
              <span className="text-xs">Profile</span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export default Header

