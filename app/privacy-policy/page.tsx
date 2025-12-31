'use client'

import React from 'react'
import { Shield } from 'lucide-react'

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-transparent sm:bg-gray-50 py-6 sm:py-12">
      <div className="max-w-4xl mx-auto px-0 sm:px-6 lg:px-8">
        <div className="bg-white sm:rounded-lg sm:shadow-sm p-6 sm:p-8">

          {/* Header */}
          <div className="text-center mb-8 border-b pb-6 border-gray-300">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Privacy Policy
            </h1>

            <p className="text-gray-600">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          {/* Content */}
          <div className="prose max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Introduction
              </h2>
              <p className="text-gray-700">
                At ConnectAfrik, we respect your privacy and are committed to
                protecting your personal data. This privacy policy explains how
                we collect, use, and safeguard your information when you use our
                platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Information We Collect
              </h2>

              <div className="space-y-6 text-gray-700">
                <div>
                  <h3 className="font-semibold mb-2">Personal Information</h3>
                  <p>We collect information you provide directly, including:</p>
                  <ul className="space-y-2 ml-4 mt-2">
                    <li>• Name and email address</li>
                    <li>• Profile information and photos</li>
                    <li>• Content you post or share</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Usage Data</h3>
                  <p>
                    We automatically collect information about how you interact
                    with our platform, including:
                  </p>
                  <ul className="space-y-2 ml-4 mt-2">
                    <li>• Device information</li>
                    <li>• IP address and location data</li>
                    <li>• Cookies and similar tracking technologies</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                How We Use Your Information
              </h2>
              <ul className="space-y-2 text-gray-700 ml-4">
                <li>• To provide and improve our services</li>
                <li>• To communicate with you about your account</li>
                <li>• To personalize your experience</li>
                <li>• To ensure platform security and prevent fraud</li>
                <li>• To comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Data Security
              </h2>
              <p className="text-gray-700">
                We implement appropriate technical and organizational measures to
                protect your personal data against unauthorized access,
                alteration, disclosure, or destruction.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Your Rights
              </h2>
              <p className="text-gray-700 mb-2">You have the right to:</p>
              <ul className="space-y-2 text-gray-700 ml-4">
                <li>• Access your personal data</li>
                <li>• Correct inaccurate data</li>
                <li>• Request deletion of your data</li>
                <li>• Object to processing of your data</li>
                <li>• Data portability</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 border-t pt-4 border-gray-400">
                Contact Us
              </h2>
              <p className="text-gray-700">
                If you have questions about this privacy policy, please contact
                us at{' '}
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

export default PrivacyPolicyPage
