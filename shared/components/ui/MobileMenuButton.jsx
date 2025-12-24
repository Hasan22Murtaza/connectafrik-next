import React, { useState } from 'react'
import { Menu, X, Users, UserPlus, ShoppingBag, Clock, Bookmark, Video, Search, Users2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { UserSearch } from './UserSearch'

const MobileMenuButton = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [showUserSearch, setShowUserSearch] = useState(false)
  const router = useRouter()

  const shortcuts = [
    { icon: Search, label: 'Search Users', action: 'search', color: 'text-green-600' },
    { icon: Users, label: 'Friends List', path: '/friends', color: 'text-purple-600' },
    { icon: UserPlus, label: 'Find Friends', path: '/mobile-friends', color: 'text-blue-600' },
    { icon: Users2, label: 'Groups', path: '/groups', color: 'text-indigo-600' },
    { icon: ShoppingBag, label: 'Marketplace', path: '/marketplace', color: 'text-orange-600' },
    { icon: Clock, label: 'Memories', path: '/memories', color: 'text-pink-600' },
    { icon: Bookmark, label: 'Saved', path: '/saved', color: 'text-yellow-600' },
    { icon: Video, label: 'Video', path: '/video', color: 'text-red-600' },
  ]

  const handleNavigation = (shortcut) => {
    if (shortcut.action === 'search') {
      setShowUserSearch(true)
      setIsOpen(false)
    } else if (shortcut.path) {
      router.push(shortcut.path)
      setIsOpen(false)
    }
  }

  return (
    <>
      {/* Floating Hamburger Button - Only visible on mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-5 right-4 z-40 bg-[#ff6900] text-white p-4 rounded-full shadow-lg hover:bg-orange-600/50 transition-all duration-300 hover:scale-110"
        aria-label="Toggle mobile menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-30 transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white z-40 rounded-t-3xl shadow-2xl transition-transform duration-300 transform translate-y-0">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Shortcuts</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Shortcuts Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {shortcuts.map((shortcut) => (
                  <button
                    key={shortcut.path || shortcut.action}
                    onClick={() => handleNavigation(shortcut)}
                    className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className={`${shortcut.color} mb-2`}>
                      <shortcut.icon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center">
                      {shortcut.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Safe area for iOS */}
              <div className="h-4" />
            </div>
          </div>
        </>
      )}

      {/* User Search Modal */}
      {showUserSearch && (
        <UserSearch
          onClose={() => setShowUserSearch(false)}
          onUserSelect={() => setShowUserSearch(false)}
        />
      )}
    </>
  )
}

export default MobileMenuButton
