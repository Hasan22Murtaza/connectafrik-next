'use client'

import React from 'react'
import { FileText, CheckCircle, XCircle } from 'lucide-react'

const GuidelinesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Community Guidelines</h1>
            <p className="text-gray-600">Help us maintain a respectful and inclusive community</p>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
              <p className="text-gray-700 mb-4">
                ConnectAfrik is a platform dedicated to fostering meaningful connections, celebrating African culture, 
                and facilitating constructive political discourse. We aim to create a safe, respectful, and inclusive 
                environment for all members of the African diaspora and continent.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
                Do's
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Respect diverse opinions and engage in constructive dialogue</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Share authentic content that celebrates African culture and heritage</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Report inappropriate content or behavior</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Protect your privacy and respect others' privacy</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Use accurate information when sharing news or political content</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <XCircle className="w-6 h-6 text-red-600 mr-2" />
                Don'ts
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-red-600 mr-2">✗</span>
                  <span>Post hate speech, harassment, or discriminatory content</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-600 mr-2">✗</span>
                  <span>Share false information or misinformation</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-600 mr-2">✗</span>
                  <span>Spam, scam, or engage in fraudulent activities</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-600 mr-2">✗</span>
                  <span>Violate intellectual property rights</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-600 mr-2">✗</span>
                  <span>Post explicit or inappropriate content</span>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Consequences</h2>
              <p className="text-gray-700 mb-4">
                Violations of these guidelines may result in content removal, account warnings, temporary suspension, 
                or permanent ban depending on the severity and frequency of violations.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Questions?</h2>
              <p className="text-gray-700">
                If you have questions about these guidelines or need to report a violation, please contact our{' '}
                <a href="/support" className="text-green-600 hover:text-green-700 font-medium">support team</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GuidelinesPage

