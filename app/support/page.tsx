'use client'

import React from 'react'
import Link from 'next/link'
import { Mail, Phone, MessageCircle, HelpCircle } from 'lucide-react'

const SupportPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <HelpCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Support Center</h1>
            <p className="text-gray-600">We're here to help you with any questions or issues</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <Mail className="w-8 h-8 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Support</h3>
              <a href="mailto:wlivinston21@gmail.com" className="text-green-600 hover:text-green-700">
                wlivinston21@gmail.com
              </a>
            </div>

            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <Phone className="w-8 h-8 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Phone Support</h3>
              <div className="space-y-1">
                <a href="tel:+233534787731" className="block text-gray-700 hover:text-green-600">
                  +233 534 787 731
                </a>
                <a href="tel:+19144337155" className="block text-gray-700 hover:text-green-600">
                  +1 914 433 7155
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div className="border-l-4 border-green-600 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">How do I create an account?</h3>
                <p className="text-gray-600">Click on "Join Community" in the header and fill out the registration form.</p>
              </div>
              <div className="border-l-4 border-green-600 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">How do I reset my password?</h3>
                <p className="text-gray-600">Go to the sign in page and click "Forgot your password?" to receive a reset link via email.</p>
              </div>
              <div className="border-l-4 border-green-600 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">How do I report inappropriate content?</h3>
                <p className="text-gray-600">Use the report button on any post or contact our support team directly.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Resources</h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/guidelines" className="text-green-600 hover:text-green-700 font-medium">
                Community Guidelines
              </Link>
              <Link href="/privacy-policy" className="text-green-600 hover:text-green-700 font-medium">
                Privacy Policy
              </Link>
              <Link href="/terms-of-service" className="text-green-600 hover:text-green-700 font-medium">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupportPage

