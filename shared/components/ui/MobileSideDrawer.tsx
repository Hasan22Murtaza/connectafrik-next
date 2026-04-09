'use client'

import {
  Search,
  X
} from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { UserSearch } from './UserSearch'
import { BsShop } from "react-icons/bs";
import {
  FaRegUser
} from "react-icons/fa";
import { FiVideo } from "react-icons/fi";
import { IoBookmarkOutline } from "react-icons/io5";
import { MdOutlineGroups2 } from "react-icons/md";
import { RiHandbagLine } from "react-icons/ri";

type MobileSideDrawerProps = {
  isOpen: boolean
  onClose: () => void
}

const MobileSideDrawer: React.FC<MobileSideDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [showUserSearch, setShowUserSearch] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const shortcuts = [
    { icon: Search, label: 'Search Users', action: 'search' },
    { icon: FaRegUser, label: 'Friends', path: '/friends' },
    { icon: MdOutlineGroups2, label: 'Groups', path: '/groups' },
    { icon: BsShop, label: 'Marketplace', path: '/marketplace' },
    { icon: RiHandbagLine, label: 'My Orders', path: '/my-orders' },
    { icon: IoBookmarkOutline, label: 'Saved', path: '/saved' },
    { icon: FiVideo, label: 'Video', path: '/video' },
  ]

  const handleClick = (item: any) => {
    if (item.action === 'search') {
      setShowUserSearch(true)
      onClose()
      return
    }

    if (item.path) {
      router.push(item.path)
      onClose()
    }
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Side Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-2/3 bg-white z-50 transform transition-transform duration-300 lg:hidden
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className=" h-full overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 bg-primary-600 px-4 py-3">
            <h3 className="text-lg font-semibold text-white">Menu</h3>
            <button onClick={onClose}>
              <X className="w-6 h-6 text-white hover:text-gray-600" />
            </button>
          </div>

          {/* List Menu */}
          <ul className="space-y-1">
            {shortcuts.map((item) => {
              const isActive = item.path && pathname === item.path

              return (
                <li key={item.label}>
                  <button
                    onClick={() => handleClick(item)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors
                      ${
                        isActive
                          ? 'bg-orange-50 text-primary-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    <item.icon
                      className={`w-5 h-5 ${
                        isActive ? 'text-primary-600' : 'text-gray-500'
                      }`}
                    />
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* Search Modal */}
      {showUserSearch && (
        <UserSearch
          onClose={() => setShowUserSearch(false)}
          onUserSelect={() => setShowUserSearch(false)}
        />
      )}
    </>
  )
}

export default MobileSideDrawer
