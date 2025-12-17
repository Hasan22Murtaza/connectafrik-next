import React from 'react'
import { X, Shield, Lock, Eye, Database, Globe, UserCheck, AlertTriangle } from 'lucide-react'

interface PrivacyModalProps {
  isOpen: boolean
  onClose: () => void
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Privacy Policy</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Introduction */}
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Privacy Matters</h3>
            <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
              At ConnectAfrik, we are committed to protecting your privacy and ensuring the security of your personal information. 
              This policy explains how we collect, use, and safeguard your data while providing our platform services.
            </p>
            <div className="mt-4 text-sm text-gray-500">
              <strong>Last Updated:</strong> January 2025 | <strong>Effective Date:</strong> January 2025
            </div>
          </div>

          {/* Information We Collect */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Database className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">Information We Collect</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-semibold text-blue-800 mb-3">Account Information</h4>
                <ul className="space-y-2 text-blue-700 text-sm">
                  <li>• Email address and password</li>
                  <li>• Full name and username</li>
                  <li>• Profile picture and bio</li>
                  <li>• Country of origin or residence</li>
                  <li>• Language preferences</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h4 className="font-semibold text-green-800 mb-3">Content & Activity</h4>
                <ul className="space-y-2 text-green-700 text-sm">
                  <li>• Posts, comments, and reactions</li>
                  <li>• Group memberships and activities</li>
                  <li>• Stories and media uploads</li>
                  <li>• Messages and communications</li>
                  <li>• Platform usage patterns</li>
                </ul>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h4 className="font-semibold text-purple-800 mb-3">Technical Data</h4>
                <ul className="space-y-2 text-purple-700 text-sm">
                  <li>• IP address and device information</li>
                  <li>• Browser type and version</li>
                  <li>• Operating system details</li>
                  <li>• Time zone and location data</li>
                  <li>• Session and analytics data</li>
                </ul>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <h4 className="font-semibold text-orange-800 mb-3">Optional Information</h4>
                <ul className="space-y-2 text-orange-700 text-sm">
                  <li>• Professional background</li>
                  <li>• Educational history</li>
                  <li>• Interests and preferences</li>
                  <li>• Contact list (with permission)</li>
                  <li>• Social media connections</li>
                </ul>
              </div>
            </div>
          </div>

          {/* How We Use Your Information */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <UserCheck className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-semibold text-gray-900">How We Use Your Information</h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Service Provision</h4>
                  <ul className="space-y-1 text-gray-600 text-sm">
                    <li>• Create and manage your account</li>
                    <li>• Display your profile and content</li>
                    <li>• Connect you with relevant groups</li>
                    <li>• Provide personalized recommendations</li>
                    <li>• Enable communication features</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Platform Improvement</h4>
                  <ul className="space-y-1 text-gray-600 text-sm">
                    <li>• Analyze usage patterns and trends</li>
                    <li>• Develop new features and services</li>
                    <li>• Improve user experience and performance</li>
                    <li>• Conduct research and analytics</li>
                    <li>• Test and optimize platform functionality</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Communication</h4>
                  <ul className="space-y-1 text-gray-600 text-sm">
                    <li>• Send important platform updates</li>
                    <li>• Provide customer support</li>
                    <li>• Share community guidelines</li>
                    <li>• Notify about new features</li>
                    <li>• Marketing (with your consent)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Safety & Security</h4>
                  <ul className="space-y-1 text-gray-600 text-sm">
                    <li>• Prevent fraud and abuse</li>
                    <li>• Enforce community guidelines</li>
                    <li>• Protect against security threats</li>
                    <li>• Investigate reported violations</li>
                    <li>• Comply with legal obligations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Data Sharing */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Globe className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-semibold text-gray-900">Data Sharing & Disclosure</h3>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <h4 className="font-semibold text-yellow-800">We Never Sell Your Data</h4>
              </div>
              <p className="text-yellow-700 text-sm mb-4">
                ConnectAfrik does not and will never sell your personal information to third parties. 
                Your data is shared only in the limited circumstances outlined below:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-yellow-800 mb-2">Public Content</h5>
                  <p className="text-yellow-700 text-xs">
                    Posts, comments, and profile information you choose to make public 
                    are visible to other users and may be indexed by search engines.
                  </p>
                </div>

                <div>
                  <h5 className="font-medium text-yellow-800 mb-2">Service Providers</h5>
                  <p className="text-yellow-700 text-xs">
                    Trusted third-party services that help us operate the platform 
                    (hosting, analytics, customer support) under strict data agreements.
                  </p>
                </div>

                <div>
                  <h5 className="font-medium text-yellow-800 mb-2">Legal Requirements</h5>
                  <p className="text-yellow-700 text-xs">
                    When required by law, court orders, or to protect the rights, 
                    property, or safety of ConnectAfrik, our users, or others.
                  </p>
                </div>

                <div>
                  <h5 className="font-medium text-yellow-800 mb-2">Business Transfers</h5>
                  <p className="text-yellow-700 text-xs">
                    In the event of a merger, acquisition, or sale of assets, 
                    user data may be transferred with advance notice to users.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Your Rights */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Eye className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-semibold text-gray-900">Your Privacy Rights</h3>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-green-800 mb-3">Access & Control</h4>
                  <ul className="space-y-2 text-green-700 text-sm">
                    <li>• View all data we have about you</li>
                    <li>• Download your data in portable format</li>
                    <li>• Correct inaccurate information</li>
                    <li>• Update your privacy preferences</li>
                    <li>• Control who sees your content</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-green-800 mb-3">Deletion & Restriction</h4>
                  <ul className="space-y-2 text-green-700 text-sm">
                    <li>• Delete your account and data</li>
                    <li>• Request data deletion</li>
                    <li>• Restrict processing of your data</li>
                    <li>• Object to certain data uses</li>
                    <li>• Withdraw consent at any time</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 p-4 bg-green-100 rounded-lg">
                <h5 className="font-medium text-green-800 mb-2">How to Exercise Your Rights</h5>
                <p className="text-green-700 text-sm">
                  Contact us at <strong>wlivinston21@gmail.com</strong> or use the privacy settings in your account 
                  dashboard. We'll respond to requests within 30 days and may need to verify your identity for security.
                </p>
              </div>
            </div>
          </div>

          {/* Data Security */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Lock className="w-6 h-6 text-red-600" />
              <h3 className="text-xl font-semibold text-gray-900">Data Security & Retention</h3>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-red-800 mb-3">Security Measures</h4>
                  <ul className="space-y-2 text-red-700 text-sm">
                    <li>• End-to-end encryption for sensitive data</li>
                    <li>• Secure HTTPS connections</li>
                    <li>• Regular security audits and updates</li>
                    <li>• Access controls and authentication</li>
                    <li>• Incident response procedures</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-red-800 mb-3">Data Retention</h4>
                  <ul className="space-y-2 text-red-700 text-sm">
                    <li>• Account data: Until account deletion</li>
                    <li>• Content: 30 days after deletion</li>
                    <li>• Analytics: Anonymized after 2 years</li>
                    <li>• Legal holds: As required by law</li>
                    <li>• Backups: 90 days maximum</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* African Data Protection */}
          <div className="bg-gradient-to-r from-african-green to-primary-600 text-white rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Globe className="w-6 h-6" />
              <h3 className="text-xl font-semibold">African Data Protection Compliance</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Regional Compliance</h4>
                <ul className="space-y-1 text-sm opacity-90">
                  <li>• South Africa: POPIA (Protection of Personal Information Act)</li>
                  <li>• Nigeria: NDPR (Nigeria Data Protection Regulation)</li>
                  <li>• Kenya: Data Protection Act</li>
                  <li>• Ghana: Data Protection Act</li>
                  <li>• Continental: African Union Data Protection Guidelines</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Our Commitment</h4>
                <p className="text-sm opacity-90">
                  We respect the sovereignty of African nations over their citizens' data and comply with 
                  local data protection laws. Data of African users is processed with special consideration 
                  for cultural context and local legal requirements.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Privacy Questions & Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Data Protection Officer</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Email: wlivinston21@gmail.com</p>
                  <p>Subject: "Privacy Request - [Your Request Type]"</p>
                  <p>Response Time: Within 30 days</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Phone Support</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Ghana: +233 534 787 731</p>
                  <p>International: +1 914 433 7155</p>
                  <p>Hours: Mon-Fri, 9AM-6PM GMT</p>
                </div>
              </div>
            </div>
          </div>

          {/* Changes to Policy */}
          <div className="border-l-4 border-blue-400 pl-6">
            <h4 className="font-semibold text-gray-800 mb-2">Changes to This Privacy Policy</h4>
            <p className="text-gray-600 text-sm">
              We may update this privacy policy from time to time to reflect changes in our practices, 
              technology, legal requirements, or for other operational reasons. We will notify users of 
              material changes via email and prominent platform notices at least 30 days before they take effect.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Your privacy is fundamental to our mission of empowering African voices.
            </p>
            <button
              onClick={onClose}
              className="btn-primary"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrivacyModal