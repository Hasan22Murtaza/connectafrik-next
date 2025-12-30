'use client'

import React from 'react'
import { FileCheck } from 'lucide-react'

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-transparent sm:bg-gray-50 py-6 sm:py-12">
      <div className="max-w-4xl mx-auto px-0 sm:px-6 lg:px-8">
        <div className="bg-white sm:rounded-lg sm:shadow-sm p-6 sm:p-8">
          
          {/* Header */}
          <div className="text-center mb-8 border-b pb-6 border-gray-300">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <FileCheck className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Terms of Service
            </h1>

            <p className="text-gray-600">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          {/* Content */}
          <div className="prose max-w-none ">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Agreement to Terms
              </h2>
              <p className="text-gray-700">
                By accessing or using ConnectAfrik, you agree to be bound by these
                Terms of Service and all applicable laws and regulations. If you
                do not agree with any of these terms, you are prohibited from
                using this platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Use License
              </h2>
              <p className="text-gray-700 mb-4">
                Permission is granted to temporarily access ConnectAfrik for
                personal, non-commercial use. This is the grant of a license, not
                a transfer of title, and under this license you may not:
              </p>
              <ul className="space-y-2 text-gray-700 ml-4">
                <li>• Modify or copy the materials</li>
                <li>• Use the materials for any commercial purpose</li>
                <li>• Attempt to reverse engineer any software</li>
                <li>• Remove any copyright or proprietary notations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                User Accounts
              </h2>
              <div className="space-y-4 text-gray-700">
                <p>
                  You are responsible for maintaining the confidentiality of
                  your account credentials and for all activities that occur
                  under your account.
                </p>
                <p>
                  You agree to provide accurate, current, and complete
                  information during registration and to update such information
                  to keep it accurate, current, and complete.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                User Content
              </h2>
              <p className="text-gray-700 mb-4">
                You retain ownership of any content you post on ConnectAfrik. By
                posting content, you grant us a worldwide, non-exclusive,
                royalty-free license to use, reproduce, and distribute your
                content on the platform.
              </p>
              <p className="text-gray-700">
                You are solely responsible for your content and agree not to post
                content that violates any laws or the rights of others.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Prohibited Activities
              </h2>
              <p className="text-gray-700 mb-2">You agree not to:</p>
              <ul className="space-y-2 text-gray-700 ml-4">
                <li>• Violate any applicable laws or regulations</li>
                <li>• Infringe on the rights of others</li>
                <li>• Post false, misleading, or fraudulent information</li>
                <li>• Engage in spam or unsolicited communications</li>
                <li>• Interfere with the platform's operation</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Termination
              </h2>
              <p className="text-gray-700">
                We reserve the right to terminate or suspend your account and
                access to the platform at our sole discretion, without prior
                notice, for conduct that we believe violates these Terms of
                Service or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Disclaimer
              </h2>
              <p className="text-gray-700">
                ConnectAfrik is provided "as is" without warranties of any kind,
                either express or implied. We do not warrant that the platform
                will be uninterrupted, secure, or error-free.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 border-t pt-4 border-gray-400">
                Contact Information
              </h2>
              <p className="text-gray-700">
                If you have any questions about these Terms of Service, please
                contact us at{' '}
                <a
                  href="mailto:wlivinston21@gmail.com"
                  className="text-green-600 hover:text-green-700"
                >
                  wlivinston21@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TermsOfServicePage
