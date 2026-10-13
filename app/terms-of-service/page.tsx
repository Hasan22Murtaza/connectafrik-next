'use client'

import React from 'react'
import { FileCheck } from '@/shared/icons'

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50/70 py-6 sm:bg-gray-50 sm:py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-none bg-white p-4 shadow-none sm:rounded-lg sm:shadow-sm sm:p-6 lg:p-8">
          <div className="mb-8 border-b border-gray-300 pb-6 text-center">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 border border-green-600 sm:h-16 sm:w-16">
                <FileCheck className="h-7 w-7 text-green-600 sm:h-8 sm:w-8" />
              </div>
            </div>

            <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Terms of Service
            </h1>

            <p className="text-sm text-gray-600 sm:text-base">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="prose prose-sm max-w-none text-gray-700 sm:prose-base">
            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900 sm:text-2xl">
                Agreement to Terms
              </h2>
              <p>
                By accessing or using CribsTalk, you agree to be bound by these
                Terms of Service and all applicable laws and regulations. If you
                do not agree with any of these terms, you are prohibited from
                using this platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900 sm:text-2xl">
                Use License
              </h2>
              <p className="mb-4">
                Permission is granted to temporarily access CribsTalk for
                personal, non-commercial use. This is the grant of a license, not
                a transfer of title, and under this license you may not:
              </p>
              <ul className="ml-4 space-y-2">
                <li>• Modify or copy the materials</li>
                <li>• Use the materials for any commercial purpose</li>
                <li>• Attempt to reverse engineer any software</li>
                <li>• Remove any copyright or proprietary notations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900 sm:text-2xl">
                User Accounts
              </h2>
              <div className="space-y-4">
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
              <h2 className="mb-3 text-xl font-semibold text-gray-900 sm:text-2xl">
                User Content
              </h2>
              <p className="mb-4">
                You retain ownership of any content you post on CribsTalk. By
                posting content, you grant us a worldwide, non-exclusive,
                royalty-free license to use, reproduce, and distribute your
                content on the platform.
              </p>
              <p>
                You are solely responsible for your content and agree not to post
                content that violates any laws or the rights of others.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900 sm:text-2xl">
                Prohibited Activities
              </h2>
              <p className="mb-2">You agree not to:</p>
              <ul className="ml-4 space-y-2">
                <li>• Violate any applicable laws or regulations</li>
                <li>• Infringe on the rights of others</li>
                <li>• Post false, misleading, or fraudulent information</li>
                <li>• Engage in spam or unsolicited communications</li>
                <li>• Interfere with the platform's operation</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900 sm:text-2xl">
                Termination
              </h2>
              <p>
                We reserve the right to terminate or suspend your account and
                access to the platform at our sole discretion, without prior
                notice, for conduct that we believe violates these Terms of
                Service or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900 sm:text-2xl">
                Disclaimer
              </h2>
              <p>
                CribsTalk is provided "as is" without warranties of any kind,
                either express or implied. We do not warrant that the platform
                will be uninterrupted, secure, or error-free.
              </p>
            </section>

            <section>
              <h2 className="mb-3 border-t border-gray-400 pt-4 text-xl font-semibold text-gray-900 sm:text-2xl">
                Contact Information
              </h2>
              <p>
                If you have any questions about these Terms of Service, please
                contact us at{' '}
                <a
                  href="mailto:info@cribstalk.com"
                  className="text-primary-700 underline-offset-2 hover:text-orange-600 hover:underline"
                >
                  info@cribstalk.com
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
