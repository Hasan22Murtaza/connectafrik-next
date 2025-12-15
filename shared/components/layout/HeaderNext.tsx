'use client'

import React from 'react'
import Link from 'next/link'
import LogoNext from '../ui/LogoNext'

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <LogoNext size="md" />
          </Link>

          {/* Navigation and Auth Links */}
          <div className="flex items-center space-x-4">
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/feed" className="text-gray-700 hover:text-green-600 font-medium">
                Feed
              </Link>
              <Link href="/politics" className="text-gray-700 hover:text-green-600 font-medium">
                Politics
              </Link>
              <Link href="/culture" className="text-gray-700 hover:text-green-600 font-medium">
                Culture
              </Link>
              <Link href="/groups" className="text-gray-700 hover:text-green-600 font-medium">
                Groups
              </Link>
            </nav>

            <div className="flex items-center space-x-4">
              <Link href="/signin" className="btn-secondary">
                Sign In
              </Link>
              <Link href="/signup" className="btn-primary">
                Join Community
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

