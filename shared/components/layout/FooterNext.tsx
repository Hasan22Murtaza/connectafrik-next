'use client'

import React from 'react'
import Link from 'next/link'
import { 
  Mail, 
  Phone, 
  Facebook, 
  Twitter, 
  Instagram, 
  Youtube,
  Heart,
  Globe
} from 'lucide-react'

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-100 text-black">
      {/* Main Footer Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <img src="/assets/images/logo_2.png" alt="" className="w-30" />
            <p className="text-gray-800 text-sm leading-relaxed">
              Connecting the African continent and diaspora through meaningful
              conversations about politics, culture, and community building.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-orange-500 transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-orange-500 transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-orange-500 transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-orange-500 transition-colors"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-black">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/feed"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  Community Feed
                </Link>
              </li>
              <li>
                <Link
                  href="/politics"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  Political Discussions
                </Link>
              </li>
              <li>
                <Link
                  href="/culture"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  Cultural Heritage
                </Link>
              </li>
              <li>
                <Link
                  href="/groups"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  Community Groups
                </Link>
              </li>
              <li>
                <Link
                  href="/our-story"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  Our Story
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Guidelines */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-black">Support & Info</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/support"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  Support Center
                </Link>
              </li>
              
              <li>
                <Link
                  href="/guidelines"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  Community Guidelines
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-of-service"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-black">Contact Us</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-gray-600" />
                <a
                  href="mailto:wlivinston21@gmail.com"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  wlivinston21@gmail.com
                </a>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-600" />
                <a
                  href="tel:+233534787731"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  +233 534 787 731
                </a>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-600" />
                <a
                  href="tel:+19144337155"
                  className="text-gray-800 hover:text-black transition-colors"
                >
                  +1 914 433 7155
                </a>
              </div>
              <div className="flex items-start space-x-2">
                <Globe className="w-4 h-4 text-gray-600 mt-0.5" />
                <span className="text-gray-800">
                  Serving Africa & Global Diaspora
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-300">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-1 text-sm text-gray-800">
              <span>© {currentYear} ConnectAfrik. Made with</span>
              <Heart className="w-4 h-4 text-red-500" />
              <span>for the African community worldwide.</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-800">
              <Link
                href="/privacy-policy"
                className="hover:text-black transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms-of-service"
                className="hover:text-black transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/guidelines"
                className="hover:text-black transition-colors"
              >
                Guidelines
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer

